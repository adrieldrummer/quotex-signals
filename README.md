# Quotex Signals

Sala de sinais 100% autônoma — Next.js fullstack + Supabase + Vercel.

3 modos de operação:
- **Simulado** — sorteia par/direção nos horários configurados, resultado via win_rate
- **Análise ao vivo** — lê candles reais da TwelveData, aplica RSI/EMA/MACD, resultado pelo preço REAL na expiração
- **Webhook Quotex** — script Python local (pyquotex) faz login na Quotex e dispara sinais via webhook

Tudo posta automaticamente em canal Telegram (sinal → aguarda expiração → print Quotex-style → resultado WIN/LOSS).

## Stack

- **Next.js 14** (App Router, TypeScript) + Tailwind
- **Supabase** (Postgres + Auth + RLS)
- **Vercel** deploy + Vercel Cron (1 min)
- **Sharp** pra gerar print SVG→PNG
- **Telegram Bot API** raw fetch

## Setup local

```bash
npm install
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (já vem default)
# preencha SUPABASE_SERVICE_ROLE_KEY: https://supabase.com/dashboard/project/caqnndkpnwdksmhtzvfh/settings/api-keys
# (opcional) TWELVEDATA_API_KEY pra modo live_analysis
npm run dev   # http://localhost:3000
```

## Deploy

1. **Push pro GitHub** (`git push -u origin main`)
2. **Vercel → New Project → Importa o repo**
3. **Env vars no Vercel:**
   - `NEXT_PUBLIC_SUPABASE_URL` = (do .env.example)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (do .env.example)
   - `SUPABASE_SERVICE_ROLE_KEY` = (do dashboard Supabase)
   - `CRON_SECRET` = (`openssl rand -hex 32`)
   - `TWELVEDATA_API_KEY` = (opcional, free em twelvedata.com)
4. **Deploy.** Cron Vercel já está em `vercel.json` (1/min).

## Primeira sala

1. Login (qualquer email, cadastro automático)
2. Configurações → cole token do bot Telegram + token TwelveData
3. Conectar canal (@canal_vip ou ID `-100...`). Bot precisa ser admin.
4. Nova sala → escolhe modo Simulado / Ao vivo / Webhook
5. Disparar agora → ver o sinal no canal

## Bridge Quotex (Python)

Pra usar Quotex de verdade (modo webhook), o bridge roda na sua máquina/VPS — veja [`bridge/README.md`](bridge/README.md).
