// Orquestrador stateless — chamado pelo cron e pelo webhook.
// Usa supabaseAdmin (service_role) pra ler/escrever ignorando RLS.

import { supabaseAdmin } from './supabase/server';
import { getCandles, getRealtimePrice, normalizeSymbol } from './marketData';
import { analyze } from './ta';
import { renderResultPng } from './printGen';
import { sendMessage, sendPhoto } from './telegram';

const TF_SEC: Record<string, number> = { M1: 60, M5: 300, M15: 900 };

type SignalOverride = {
  pair: string; direction: 'CALL' | 'PUT';
  entry_price?: number | null; reason?: string | null; confidence?: number | null;
};

// =====================================================
// Dispara uma session (sinal -> follow-up)
// =====================================================
export async function runSession(roomId: number, override: SignalOverride | null = null) {
  const sb = supabaseAdmin();
  const { data: roomRow, error } = await sb
    .from('signal_rooms')
    .select('*, channels(telegram_chat_id), workspaces(telegram_bot_token)')
    .eq('id', roomId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!roomRow) return null;
  const room: any = roomRow;
  const botToken: string | null = room.workspaces?.telegram_bot_token || null;
  const chatId: number | null = room.channels?.telegram_chat_id || null;

  // 1. parâmetros
  let pair: string, direction: 'CALL' | 'PUT';
  if (override) { pair = override.pair; direction = override.direction; }
  else {
    const pairs: string[] = parseJson(room.pairs, ['EUR/USD']);
    const base = pairs[Math.floor(Math.random() * pairs.length)];
    pair = room.use_otc ? `${base} OTC` : base;
    direction = Math.random() < 0.5 ? 'CALL' : 'PUT';
  }
  const amount = randInt(room.amount_min || 100, room.amount_max || 300);
  const payout = randInt(room.payout_min || 85, room.payout_max || 94);
  const tfSec = TF_SEC[room.timeframe] || 60;
  const openTime = new Date();
  const expirationAt = new Date(Date.now() + tfSec * 1000 + (room.gale_levels || 1) * tfSec * 1000);

  // 2. cria session
  const { data: session } = await sb.from('signal_room_sessions').insert({
    workspace_id: room.workspace_id, room_id: roomId, pair, direction,
    timeframe: room.timeframe, entry_amount: amount, payout_pct: payout,
    open_time: openTime.toISOString(), expiration_at: expirationAt.toISOString(),
    status: 'pending', entry_price: override?.entry_price ?? null,
    analysis_reason: override?.reason ?? null, confidence: override?.confidence ?? null,
  }).select().single();

  if (!session) throw new Error('falha criando session');

  try {
    // 3. monta texto
    const text = buildSignalText({ pair, direction, amount, payout, openTime,
      timeframe: room.timeframe, gale: room.gale_levels, reason: override?.reason, confidence: override?.confidence });

    // 4. posta no Telegram
    let msgId: number | null = null;
    if (botToken && chatId) {
      const sent = await sendMessage(botToken, chatId, text, {
        reply_markup: room.cta_link ? {
          inline_keyboard: [[{ text: room.cta_text || '🚀 Acessar', url: room.cta_link }]],
        } : undefined,
      });
      msgId = sent.message_id;
    }

    await sb.from('signal_room_sessions').update({
      status: 'signal_sent', signal_message_id: msgId,
    }).eq('id', session.id);

    await sb.from('signal_rooms').update({
      last_run_at: new Date().toISOString(),
      total_sessions: (room.total_sessions || 0) + 1,
    }).eq('id', roomId);

    return session;
  } catch (err: any) {
    await sb.from('signal_room_sessions').update({
      status: 'failed', error_message: String(err.message || err).slice(0, 500),
    }).eq('id', session.id);
    throw err;
  }
}

// =====================================================
// Roda follow-up de UMA session: gera resultado + print + posta
// =====================================================
export async function runFollowup(sessionId: number) {
  const sb = supabaseAdmin();
  const { data: s } = await sb
    .from('signal_room_sessions')
    .select('*, signal_rooms(*, channels(telegram_chat_id), workspaces(telegram_bot_token))')
    .eq('id', sessionId)
    .maybeSingle();
  if (!s || s.result) return;

  const room: any = s.signal_rooms;
  const botToken: string | null = room?.workspaces?.telegram_bot_token || null;
  const chatId: number | null = room?.channels?.telegram_chat_id || null;

  // Decide WIN/LOSS
  let isWin: boolean, exitPrice: number | null = null;
  if (room.mode === 'live_analysis' && s.entry_price != null) {
    try {
      exitPrice = await getRealtimePrice(s.pair);
      isWin = s.direction === 'CALL' ? exitPrice > Number(s.entry_price) : exitPrice < Number(s.entry_price);
    } catch {
      isWin = Math.random() * 100 < (room.win_rate ?? 85);
    }
  } else {
    isWin = Math.random() * 100 < (room.win_rate ?? 85);
  }

  const result = isWin ? 'WIN' : 'LOSS';
  const profit = isWin
    ? Number((Number(s.entry_amount) * Number(s.payout_pct) / 100).toFixed(2))
    : -Number(s.entry_amount);

  // Print
  const png = await renderResultPng({
    pair: s.pair, direction: s.direction as any,
    amount: Number(s.entry_amount), payout: Number(s.payout_pct),
    profit, result: result as any, timeframe: s.timeframe || 'M1',
    openTime: new Date(s.open_time), closingTime: new Date(),
  });

  // Caption + post
  const caption = isWin
    ? `${randHeadline(true)}\n\n💰 +$${profit.toFixed(2)} no ${s.pair}\n🎯 ${s.direction}\n\n${randSub(true)}`
    : `${randHeadline(false)}\n\n📉 ${Math.abs(profit).toFixed(2)}$ no ${s.pair}\n💪 ${randSub(false)}`;

  let resultMsgId: number | null = null;
  if (botToken && chatId) {
    const sent = await sendPhoto(botToken, chatId, png, caption);
    resultMsgId = sent.message_id;
  }

  await sb.from('signal_room_sessions').update({
    result, profit, exit_price: exitPrice, result_message_id: resultMsgId,
    status: 'result_sent', result_sent_at: new Date().toISOString(),
  }).eq('id', s.id);

  await sb.from('signal_rooms').update({
    total_wins: (room.total_wins || 0) + (isWin ? 1 : 0),
    total_losses: (room.total_losses || 0) + (isWin ? 0 : 1),
  }).eq('id', s.room_id);
}

// =====================================================
// Processa todos follow-ups vencidos (chamado pelo cron)
// =====================================================
export async function processDueFollowups() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('signal_room_sessions')
    .select('id')
    .is('result', null)
    .eq('status', 'signal_sent')
    .lt('expiration_at', new Date(Date.now() - 3000).toISOString())
    .limit(20);
  for (const r of data || []) {
    await runFollowup(r.id).catch(err => console.error('[followup]', r.id, err.message));
  }
}

// =====================================================
// Scan rooms com schedule_times batendo agora (modo simulated)
// =====================================================
export async function processScheduledRooms() {
  const sb = supabaseAdmin();
  const { data: rooms } = await sb
    .from('signal_rooms')
    .select('id, schedule_times, schedule_weekdays, mode, last_run_at')
    .eq('is_active', true)
    .neq('mode', 'webhook');
  const now = nowBrasilia();
  const hhmm = `${pad(now.h)}:${pad(now.m)}`;
  for (const r of rooms || []) {
    const times = parseJson(r.schedule_times, []);
    const days = parseJson(r.schedule_weekdays, [1,2,3,4,5]);
    if (!days.includes(now.dow)) continue;
    if (!times.includes(hhmm)) continue;
    // não dispara 2x no mesmo minuto
    if (r.last_run_at && (Date.now() - new Date(r.last_run_at).getTime()) < 60_000) continue;
    await runSession(r.id).catch(err => console.error('[scheduled]', r.id, err.message));
  }
}

// =====================================================
// Scan rooms mode='live_analysis' — poll TwelveData
// =====================================================
export async function processLiveRooms() {
  if (!process.env.TWELVEDATA_API_KEY) return;
  const sb = supabaseAdmin();
  const { data: rooms } = await sb
    .from('signal_rooms')
    .select('*')
    .eq('is_active', true)
    .eq('mode', 'live_analysis');
  for (const room of rooms || []) {
    const pairs = parseJson(room.pairs, []);
    for (const pairBase of pairs) {
      try { await analyzeAndDispatch(room, pairBase); }
      catch (err: any) { console.warn('[live]', room.id, pairBase, err.message); }
    }
  }
}

async function analyzeAndDispatch(room: any, pairBase: string) {
  const sb = supabaseAdmin();
  const cooldownMin = room.cooldown_minutes ?? 5;

  const { data: state } = await sb
    .from('signal_room_pair_state').select('last_signaled_at')
    .eq('room_id', room.id).eq('pair', pairBase).maybeSingle();
  if (state?.last_signaled_at) {
    const ageMin = (Date.now() - new Date(state.last_signaled_at).getTime()) / 60000;
    if (ageMin < cooldownMin) return;
  }

  const interval = ({ M1: '1min', M5: '5min', M15: '15min' } as any)[room.timeframe] || '1min';
  const candles = await getCandles(pairBase, interval, 60);
  const verdict = analyze(candles, room.strategy || 'rsi_oversold_overbought');
  if (!verdict.signal) return;
  if (verdict.confidence < (room.min_confidence ?? 60)) return;

  await sb.from('signal_room_pair_state').upsert({
    room_id: room.id, pair: pairBase,
    last_signaled_at: new Date().toISOString(),
    last_signal_direction: verdict.signal,
  });

  const pair = room.use_otc ? `${pairBase} OTC` : pairBase;
  const entryPrice = candles[candles.length - 1].close;
  await runSession(room.id, {
    pair, direction: verdict.signal,
    reason: verdict.reason, confidence: verdict.confidence,
    entry_price: entryPrice,
  });
}

// =====================================================
// Webhook externo (pyquotex)
// =====================================================
export async function injectSignal(roomId: number, payload: any) {
  if (!payload.pair || !payload.direction) throw new Error('pair e direction obrigatórios');
  if (!['CALL', 'PUT'].includes(payload.direction)) throw new Error('direction deve ser CALL|PUT');
  return runSession(roomId, {
    pair: payload.pair, direction: payload.direction,
    entry_price: payload.entry_price ?? null,
    reason: payload.reason || 'sinal externo (Quotex)',
    confidence: payload.confidence ?? null,
  });
}

// =====================================================
// Helpers
// =====================================================
function parseJson(v: any, fb: any) {
  if (!v) return fb;
  if (Array.isArray(v) || typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fb; }
}
function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pad(n: number) { return String(n).padStart(2, '0'); }
function nowBrasilia() {
  // Sao Paulo TZ offset = -03:00 (sem DST atualmente)
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), dow: d.getUTCDay() };
}

function buildSignalText(o: any) {
  const dir = o.direction === 'CALL' ? '🟢 CALL' : '🔴 PUT';
  const lines = [
    '🚨 *SINAL CONFIRMADO* 🚨',
    '',
    `📊 Par: *${o.pair}*`,
    `⏰ Horário: *${pad(o.openTime.getHours())}:${pad(o.openTime.getMinutes())}* (Brasília)`,
    `🎯 Direção: *${dir}*`,
    `⏱ Expiração: *${o.timeframe || 'M1'}*`,
    `🛡 Proteção: até G${o.gale || 1}`,
    `💎 Valor sugerido: $${o.amount}  •  Payout +${o.payout}%`,
  ];
  if (o.reason) lines.push(`\n📈 _${o.reason}_`);
  if (o.confidence) lines.push(`🎯 Confiança: *${o.confidence}%*`);
  lines.push('\nDisciplina é tudo. Bora! 🚀');
  return lines.join('\n');
}

const WIN_HL = ['✅ WIN DIRETO ✅', '🟢 GAIN CONFIRMADO 🟢', '🎯 BATEU FÁCIL 🎯'];
const WIN_SUB = ['Bora pro próximo! 🔥', 'Disciplina paga 💰', 'Mais um green 📈'];
const LOSS_HL = ['🔴 LOSS — segue o jogo', '⚠️ Refluxo — próximo é nosso'];
const LOSS_SUB = ['Mercado é assim 💪', 'Gerenciamento manda ⚡'];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
function randHeadline(win: boolean) { return pick(win ? WIN_HL : LOSS_HL); }
function randSub(win: boolean) { return pick(win ? WIN_SUB : LOSS_SUB); }
