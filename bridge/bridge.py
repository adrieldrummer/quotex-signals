"""
Quotex Bridge — conecta na Quotex (via pyquotex), monitora pares em tempo real,
aplica análise técnica e dispara sinais pro backend ChatFunnel.

Uso:
    cp .env.example .env  # preencha
    pip install -r requirements.txt
    python bridge.py

Loga tudo no stdout + arquivo bridge.log.
"""
import os
import sys
import time
import json
import logging
import asyncio
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

from indicators import analyze

# pyquotex import — só importamos quando precisar, pra mensagem de erro ser clara
try:
    from pyquotex.stable_api import Quotex
except Exception as exc:
    print("❌ pyquotex não instalado. Rode: pip install -r requirements.txt")
    print(f"   detalhe: {exc}")
    sys.exit(1)

VERSION = "1.0.0"
load_dotenv()

# ============================================================
# CONFIG
# ============================================================
def env(k, default=None, cast=str):
    v = os.getenv(k, default)
    if v is None:
        return None
    try:
        return cast(v)
    except Exception:
        return default

QUOTEX_EMAIL = env("QUOTEX_EMAIL")
QUOTEX_PASSWORD = env("QUOTEX_PASSWORD")
QUOTEX_ACCOUNT_TYPE = env("QUOTEX_ACCOUNT_TYPE", "PRACTICE")
WEBHOOK_BASE_URL = env("WEBHOOK_BASE_URL", "http://localhost:3001")
ROOM_ID = env("ROOM_ID")
ROOM_SECRET = env("ROOM_SECRET")
PAIRS = [p.strip() for p in env("PAIRS", "EURUSD_otc").split(",") if p.strip()]
STRATEGY = env("STRATEGY", "rsi_oversold_overbought")
MIN_CONFIDENCE = env("MIN_CONFIDENCE", 65, int)
COOLDOWN_SECONDS = env("COOLDOWN_SECONDS", 300, int)
CANDLE_PERIOD = env("CANDLE_PERIOD", 60, int)
CANDLE_COUNT = env("CANDLE_COUNT", 60, int)
HEARTBEAT_INTERVAL = env("HEARTBEAT_INTERVAL", 30, int)

for k, v in [("QUOTEX_EMAIL", QUOTEX_EMAIL), ("QUOTEX_PASSWORD", QUOTEX_PASSWORD),
             ("ROOM_ID", ROOM_ID), ("ROOM_SECRET", ROOM_SECRET)]:
    if not v:
        print(f"❌ Falta config: {k} (veja .env.example)")
        sys.exit(1)

# ============================================================
# LOGGING
# ============================================================
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout),
              logging.FileHandler("bridge.log", encoding="utf-8")],
)
log = logging.getLogger("bridge")

# ============================================================
# ESTADO
# ============================================================
last_signal_at: Dict[str, float] = {}  # pair -> timestamp
last_error: Optional[str] = None
state_lock = threading.Lock()


# ============================================================
# WEBHOOK CALLS
# ============================================================
def webhook_url(path: str) -> str:
    return f"{WEBHOOK_BASE_URL}/api/signals/{ROOM_ID}/{path}"


def categorize_asset(symbol: str, kind: str) -> str:
    s = symbol.lower()
    if "_otc" in s: return "OTC"
    if kind == "cryptocurrency": return "Cripto"
    if kind == "stock" or "-" in symbol and "_otc" not in s: return "Ações"
    return "Forex"


async def fetch_assets_snapshot(client) -> list:
    """Pega lista de TODOS os ativos da Quotex com status atual."""
    try:
        all_assets = await client.get_all_assets() if hasattr(client, 'get_all_assets') else None
        if not all_assets:
            return []
        out = []
        for sym, info in all_assets.items():
            # info varia de versao, tentamos extrair com fallbacks
            try:
                # pyquotex >=1: dict com {nome, tipo, payout, is_open}
                name = info.get("name") if isinstance(info, dict) else None
                kind = info.get("type", "") if isinstance(info, dict) else ""
                payout = info.get("payout", 0) if isinstance(info, dict) else 0
                is_open = info.get("is_open", False) if isinstance(info, dict) else False
                out.append({
                    "symbol": sym,
                    "name": name or sym,
                    "category": categorize_asset(sym, kind),
                    "is_open": bool(is_open),
                    "payout": int(payout) if payout else 0,
                })
            except Exception:
                continue
        return out
    except Exception as e:
        log.debug(f"fetch_assets falhou: {e}")
        return []


async def send_heartbeat(client, status: str = "online"):
    """Reporta estado pro backend pra aparecer no dashboard."""
    try:
        balance = await get_balance_safe(client) if client else None
        assets = await fetch_assets_snapshot(client) if client else []
        payload = {
            "secret": ROOM_SECRET,
            "status": status,
            "version": VERSION,
            "account_balance": balance,
            "account_email": QUOTEX_EMAIL,
            "account_type": QUOTEX_ACCOUNT_TYPE,
            "pairs_watching": PAIRS,
            "assets": assets,
            "last_error": last_error,
        }
        r = requests.post(webhook_url("heartbeat"), json=payload, timeout=15)
        if not r.ok:
            log.warning(f"heartbeat http {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.warning(f"heartbeat falhou: {e}")


def send_signal(pair: str, direction: str, entry_price: float, verdict: Dict):
    payload = {
        "secret": ROOM_SECRET,
        "pair": format_pair_for_label(pair),
        "direction": direction,
        "entry_price": entry_price,
        "reason": verdict.get("reason"),
        "confidence": verdict.get("confidence"),
    }
    try:
        r = requests.post(webhook_url("inject-signal"), json=payload, timeout=15)
        if r.ok:
            log.info(f"✅ sinal enviado {pair} {direction} @{entry_price} conf={verdict.get('confidence')}")
            return True
        else:
            log.error(f"❌ webhook http {r.status_code}: {r.text[:300]}")
            return False
    except Exception as e:
        log.error(f"❌ webhook erro: {e}")
        return False


def format_pair_for_label(pair: str) -> str:
    """EURUSD_otc -> EUR/USD OTC, EURUSD -> EUR/USD"""
    base = pair.upper().replace("_OTC", "")
    is_otc = "_OTC" in pair.upper()
    if len(base) == 6:
        formatted = f"{base[:3]}/{base[3:]}"
    else:
        formatted = base
    return f"{formatted} OTC" if is_otc else formatted


# ============================================================
# QUOTEX
# ============================================================
async def connect_quotex() -> Quotex:
    log.info(f"🔐 conectando Quotex ({QUOTEX_EMAIL}, {QUOTEX_ACCOUNT_TYPE})...")
    client = Quotex(email=QUOTEX_EMAIL, password=QUOTEX_PASSWORD)
    check, reason = await client.connect()
    if not check:
        raise RuntimeError(f"login falhou: {reason}")
    await client.change_account(QUOTEX_ACCOUNT_TYPE)
    bal = await client.get_balance()
    log.info(f"✅ conectado — saldo {bal} ({QUOTEX_ACCOUNT_TYPE})")
    return client


async def get_balance_safe(client: Quotex):
    try: return await client.get_balance()
    except Exception: return None


async def fetch_candles(client: Quotex, pair: str, period: int, count: int) -> List[Dict]:
    """
    Retorna candles antigos->novos. Cada um {open, high, low, close, time}.
    """
    end_time = int(time.time())
    raw = await client.get_candles(pair, end_time, count * period, period)
    if not raw:
        return []
    candles = []
    for c in raw:
        candles.append({
            "open": float(c.get("open", 0)),
            "high": float(c.get("high", c.get("max", 0))),
            "low": float(c.get("low", c.get("min", 0))),
            "close": float(c.get("close", 0)),
            "time": c.get("time"),
        })
    # Ordena pelo time pra garantir antigo->novo
    candles.sort(key=lambda x: x.get("time") or 0)
    return candles


# ============================================================
# LOOP PRINCIPAL
# ============================================================
async def analyze_pair(client: Quotex, pair: str):
    global last_error
    now = time.time()
    # cooldown
    with state_lock:
        ts = last_signal_at.get(pair, 0)
        if now - ts < COOLDOWN_SECONDS:
            return

    try:
        candles = await fetch_candles(client, pair, CANDLE_PERIOD, CANDLE_COUNT)
    except Exception as e:
        log.warning(f"[{pair}] candles falhou: {e}")
        last_error = f"candles {pair}: {e}"
        return

    if len(candles) < 30:
        log.debug(f"[{pair}] só {len(candles)} candles, pulando")
        return

    verdict = analyze(candles, STRATEGY)
    sig = verdict.get("signal")
    conf = verdict.get("confidence", 0)

    if not sig:
        log.debug(f"[{pair}] sem sinal: {verdict.get('reason')}")
        return
    if conf < MIN_CONFIDENCE:
        log.info(f"[{pair}] {sig} confiança {conf}% < min {MIN_CONFIDENCE}% — pula")
        return

    entry_price = candles[-1]["close"]
    log.info(f"🎯 [{pair}] {sig} {conf}% — {verdict.get('reason')}")
    sent = send_signal(pair, sig, entry_price, verdict)
    if sent:
        with state_lock:
            last_signal_at[pair] = now


async def main_loop():
    client = None
    while True:
        try:
            if client is None:
                client = await connect_quotex()
                await send_heartbeat(client, "online")

            # Analisa cada par em sequência (pra não saturar o ws)
            for pair in PAIRS:
                await analyze_pair(client, pair)
                await asyncio.sleep(1)

            # Heartbeat periódico
            await send_heartbeat(client, "online")
            # Aguarda próximo ciclo (5s entre rodadas — ajuste se quiser mais agressivo)
            await asyncio.sleep(5)

        except KeyboardInterrupt:
            log.info("encerrando...")
            await send_heartbeat(client, "stopped")
            return
        except Exception as e:
            log.exception("erro no loop principal — reconectando em 30s")
            global last_error
            last_error = str(e)[:500]
            await send_heartbeat(None, "error")
            client = None
            await asyncio.sleep(30)


if __name__ == "__main__":
    log.info(f"🚀 Quotex Bridge v{VERSION}")
    log.info(f"   sala={ROOM_ID} estrategia={STRATEGY} pares={PAIRS}")
    log.info(f"   conta={QUOTEX_ACCOUNT_TYPE} confianca_min={MIN_CONFIDENCE}% cooldown={COOLDOWN_SECONDS}s")
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        pass
