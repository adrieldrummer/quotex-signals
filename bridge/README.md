# Quotex Bridge

Conecta na Quotex em tempo real, analisa candles e dispara sinais pro backend ChatFunnel.

## Por que precisa rodar local/VPS?

A Quotex não tem API oficial pública. Usamos `pyquotex` (reverse engineering do websocket) — exige login real, viola TOS e quebra se eles atualizarem o protocolo. **Use conta DEMO pra testar.**

O backend (Render/Vercel) é Node.js sem Python, então o bridge roda **na sua máquina ou VPS**, faz a ponte e dispara sinais via webhook.

## Setup (5 min)

```bash
# 1. Clone só essa pasta ou baixe os 4 arquivos
cd tools/quotex_bridge

# 2. Crie ambiente Python (opcional mas recomendado)
python -m venv venv
source venv/bin/activate    # Linux/Mac
venv\Scripts\activate       # Windows

# 3. Instale deps
pip install -r requirements.txt

# 4. Configure
cp .env.example .env
# edite .env com seu email Quotex, senha, ROOM_ID e ROOM_SECRET
#   ROOM_ID e ROOM_SECRET ficam na aba "Webhook" do dashboard
```

## Rodando

```bash
python bridge.py
```

Você vai ver algo como:
```
🚀 Quotex Bridge v1.0.0
   sala=1 estrategia=rsi_oversold_overbought pares=['EURUSD_otc', 'GBPUSD_otc']
   conta=PRACTICE confianca_min=65% cooldown=300s
🔐 conectando Quotex...
✅ conectado — saldo 10000.0 (PRACTICE)
🎯 [EURUSD_otc] CALL 78% — RSI=22.4 < 30 (sobrevenda)
✅ sinal enviado EURUSD_otc CALL @1.08456 conf=78
```

E no dashboard `/signal-rooms`, o card da sala mostra:
- 🟢 Bridge online (heartbeat a cada 30s)
- Saldo da conta Quotex
- Contador de sinais hoje
- Último sinal disparado

## Rodar 24/7

### Opção 1 — VPS Linux + systemd

```ini
# /etc/systemd/system/quotex-bridge.service
[Unit]
Description=Quotex Bridge
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/quotex_bridge
ExecStart=/home/youruser/quotex_bridge/venv/bin/python bridge.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now quotex-bridge
journalctl -u quotex-bridge -f
```

### Opção 2 — Windows (Task Scheduler)

Crie atalho `bridge.bat`:
```bat
@echo off
cd /d C:\caminho\quotex_bridge
venv\Scripts\python.exe bridge.py
```
Use Task Scheduler com "Run whether user is logged on or not" + "If task fails, restart every 1 minute".

### Opção 3 — Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "bridge.py"]
```

## Estratégias disponíveis

Mesmas do backend, espelhadas em `indicators.py`:

| Estratégia | Descrição |
|-----------|-----------|
| `rsi_oversold_overbought` | RSI<30=CALL, RSI>70=PUT (default) |
| `ema_crossover` | EMA9 cruza EMA21 |
| `multi_confluence` | ≥2 de RSI+MACD+candle pattern concordam |

## Troubleshooting

**`login falhou: invalid credentials`** — confira email/senha. Quotex bloqueia IPs que tentam muito.

**`candles falhou: ...`** — par errado ou mercado fechado. Pares `_otc` rodam 24/7, sem `_otc` só em horário comercial.

**Bridge fica offline no dashboard** — checa `bridge.log` na pasta. Se "Connection refused" o `WEBHOOK_BASE_URL` tá errado.

**pyquotex parou de funcionar** — provável update da Quotex. Atualize: `pip install -U pyquotex`. Se não tiver fix, considere `mode='live_analysis'` no painel (usa TwelveData, mais estável).
