"""
Indicadores técnicos puros — espelha o backend Node (technicalAnalysis.js).
Sem dependência de talib (numpy basta).
"""
from typing import List, Optional, Dict, Tuple
import numpy as np


def sma(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return []
    arr = np.array(values, dtype=float)
    return np.convolve(arr, np.ones(period) / period, mode="valid").tolist()


def ema(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return []
    arr = np.array(values, dtype=float)
    k = 2 / (period + 1)
    out = [float(arr[:period].mean())]
    for v in arr[period:]:
        out.append(float(v) * k + out[-1] * (1 - k))
    return out


def rsi(closes: List[float], period: int = 14) -> List[float]:
    if len(closes) < period + 1:
        return []
    diffs = np.diff(closes)
    gains = np.clip(diffs, 0, None)
    losses = -np.clip(diffs, None, 0)
    avg_gain = gains[:period].mean()
    avg_loss = losses[:period].mean()
    out = []
    out.append(_rsi_from_avg(avg_gain, avg_loss))
    for i in range(period, len(diffs)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        out.append(_rsi_from_avg(avg_gain, avg_loss))
    return out


def _rsi_from_avg(g: float, l: float) -> float:
    if l == 0:
        return 100.0
    rs = g / l
    return 100 - 100 / (1 + rs)


def macd(closes: List[float], fast: int = 12, slow: int = 26, signal_period: int = 9
        ) -> Dict[str, List[float]]:
    if len(closes) < slow + signal_period:
        return {"line": [], "signal": [], "hist": []}
    fast_e = ema(closes, fast)
    slow_e = ema(closes, slow)
    offset = slow - fast
    aligned = fast_e[offset:]
    line = [a - s for a, s in zip(aligned, slow_e)]
    sig = ema(line, signal_period)
    hist_offset = len(line) - len(sig)
    hist = [line[i + hist_offset] - sig[i] for i in range(len(sig))]
    return {"line": line[hist_offset:], "signal": sig, "hist": hist}


def detect_candle_pattern(candles: List[Dict]) -> Optional[str]:
    if len(candles) < 2:
        return None
    c = candles[-1]
    p = candles[-2]
    body = abs(c["close"] - c["open"])
    rng = c["high"] - c["low"]
    upper = c["high"] - max(c["open"], c["close"])
    lower = min(c["open"], c["close"]) - c["low"]
    if rng == 0:
        return None
    if body / rng < 0.1:
        return "doji"
    c_bull = c["close"] > c["open"]
    p_bull = p["close"] > p["open"]
    p_body = abs(p["close"] - p["open"])
    if c_bull and not p_bull and c["close"] > p["open"] and c["open"] < p["close"] and body > p_body:
        return "bullish_engulfing"
    if not c_bull and p_bull and c["close"] < p["open"] and c["open"] > p["close"] and body > p_body:
        return "bearish_engulfing"
    if body / rng < 0.3:
        if lower > body * 2 and upper < body:
            return "hammer"
        if upper > body * 2 and lower < body:
            return "shooting_star"
    return None


# =====================================================
# ESTRATÉGIAS
# =====================================================
def analyze(candles: List[Dict], strategy: str = "rsi_oversold_overbought"
           ) -> Dict:
    """
    candles: ordenados antigo->novo, cada um com {open, high, low, close}
    Retorna: {signal: 'CALL'|'PUT'|None, confidence: int, reason: str, indicators: dict}
    """
    if not candles:
        return {"signal": None, "confidence": 0, "reason": "sem candles", "indicators": {}}
    closes = [c["close"] for c in candles]

    if strategy == "rsi_oversold_overbought":
        if len(closes) < 30:
            return {"signal": None, "confidence": 0, "reason": "precisa >=30 candles", "indicators": {}}
        r = rsi(closes, 14)
        last = r[-1]
        if last < 30:
            return {
                "signal": "CALL",
                "confidence": int(100 - (last / 30) * 100),
                "reason": f"RSI={last:.1f} < 30 (sobrevenda)",
                "indicators": {"rsi": last},
            }
        if last > 70:
            return {
                "signal": "PUT",
                "confidence": int(((last - 70) / 30) * 100),
                "reason": f"RSI={last:.1f} > 70 (sobrecompra)",
                "indicators": {"rsi": last},
            }
        return {"signal": None, "confidence": 0, "reason": f"RSI={last:.1f} neutro",
                "indicators": {"rsi": last}}

    if strategy == "ema_crossover":
        if len(closes) < 30:
            return {"signal": None, "confidence": 0, "reason": "precisa >=30 candles", "indicators": {}}
        fast_e = ema(closes, 9)
        slow_e = ema(closes, 21)
        offset = 21 - 9
        aligned = fast_e[offset:]
        last_fast, prev_fast = aligned[-1], aligned[-2]
        last_slow, prev_slow = slow_e[-1], slow_e[-2]
        crossed_up = prev_fast <= prev_slow and last_fast > last_slow
        crossed_down = prev_fast >= prev_slow and last_fast < last_slow
        spread = abs(last_fast - last_slow) / last_slow * 10000
        if crossed_up:
            return {"signal": "CALL", "confidence": min(95, 50 + int(spread * 5)),
                    "reason": f"EMA9 cruzou EMA21 pra cima (+{spread:.1f}pip)",
                    "indicators": {"emaFast": last_fast, "emaSlow": last_slow}}
        if crossed_down:
            return {"signal": "PUT", "confidence": min(95, 50 + int(spread * 5)),
                    "reason": f"EMA9 cruzou EMA21 pra baixo (-{spread:.1f}pip)",
                    "indicators": {"emaFast": last_fast, "emaSlow": last_slow}}
        return {"signal": None, "confidence": 0, "reason": "sem cruzamento",
                "indicators": {"emaFast": last_fast, "emaSlow": last_slow}}

    if strategy == "multi_confluence":
        if len(closes) < 40:
            return {"signal": None, "confidence": 0, "reason": "precisa >=40 candles", "indicators": {}}
        r = rsi(closes, 14)
        m = macd(closes)
        pattern = detect_candle_pattern(candles)
        last_r = r[-1] if r else None
        last_hist = m["hist"][-1] if m["hist"] else None
        prev_hist = m["hist"][-2] if len(m["hist"]) > 1 else None
        votes, reasons = [], []
        if last_r is not None:
            if last_r < 30:
                votes.append("CALL"); reasons.append(f"RSI {last_r:.1f} oversold")
            elif last_r > 70:
                votes.append("PUT"); reasons.append(f"RSI {last_r:.1f} overbought")
        if last_hist is not None and prev_hist is not None:
            if prev_hist <= 0 < last_hist:
                votes.append("CALL"); reasons.append("MACD hist virou positivo")
            elif prev_hist >= 0 > last_hist:
                votes.append("PUT"); reasons.append("MACD hist virou negativo")
        if pattern in ("bullish_engulfing", "hammer"):
            votes.append("CALL"); reasons.append(f"candle {pattern}")
        elif pattern in ("bearish_engulfing", "shooting_star"):
            votes.append("PUT"); reasons.append(f"candle {pattern}")
        calls = votes.count("CALL")
        puts = votes.count("PUT")
        indicators = {"rsi": last_r, "macdHist": last_hist, "pattern": pattern}
        if calls >= 2 and calls > puts:
            return {"signal": "CALL", "confidence": min(95, 60 + calls * 10),
                    "reason": f"{calls}/3 CALL: " + ", ".join(reasons), "indicators": indicators}
        if puts >= 2 and puts > calls:
            return {"signal": "PUT", "confidence": min(95, 60 + puts * 10),
                    "reason": f"{puts}/3 PUT: " + ", ".join(reasons), "indicators": indicators}
        return {"signal": None, "confidence": 0, "reason": "sem confluência", "indicators": indicators}

    raise ValueError(f"Estratégia desconhecida: {strategy}")
