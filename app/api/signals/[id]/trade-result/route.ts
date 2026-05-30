// Webhook que o bridge chama DEPOIS de executar trade real na Quotex.
// Gera print platform-style + copy humano e posta no Telegram.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { renderPlatformPng } from '@/lib/platformPrint';
import { buildHumanCopy } from '@/lib/humanCopy';
import { sendPhoto } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const {
      secret,
      session_id,
      pair,                 // ex "CAD/JPY (OTC)"
      direction,            // CALL | PUT
      investment,           // 20
      payout,               // 85
      result,               // WIN | LOSS
      profit,               // 37 ou -20
      open_price, close_price,
      quotex_trade_id,
      expiration_minutes,   // 1 | 5
    } = body || {};

    if (!secret) return NextResponse.json({ error: 'secret obrigatório' }, { status: 401 });
    if (!pair || !direction || !result) return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: room } = await sb.from('signal_rooms')
      .select('id, workspace_id, webhook_secret, cta_link, cta_text, workspaces(telegram_bot_token), channels(telegram_chat_id)')
      .eq('id', params.id).maybeSingle();
    if (!room) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 });
    if (room.webhook_secret !== secret) return NextResponse.json({ error: 'secret inválido' }, { status: 403 });

    const r: any = room;
    const botToken: string = r.workspaces?.telegram_bot_token;
    const chatId: number = r.channels?.telegram_chat_id;
    if (!botToken || !chatId) return NextResponse.json({ error: 'sem bot/canal configurado' }, { status: 400 });

    // 1. gerar print
    const png = await renderPlatformPng({
      pair: pair, payout: Number(payout || 85),
      investment: Number(investment || 20),
      result: (result as any),
      profit: Number(profit || 0),
      direction: (direction as any),
      openPrice: open_price ? Number(open_price) : undefined,
      closePrice: close_price ? Number(close_price) : undefined,
      expirationMinutes: Number(expiration_minutes || 1),
    });

    // 2. caption humano
    const caption = buildHumanCopy({
      result: result as any, pair, investment: Number(investment),
      profit: Number(profit), direction: direction as any,
    });

    // 3. postar no Telegram
    const sent = await sendPhoto(botToken, chatId, png, caption, {
      reply_markup: r.cta_link ? {
        inline_keyboard: [[{ text: r.cta_text || '🚀 Operar comigo', url: r.cta_link }]],
      } : undefined,
    });

    // 4. salvar histórico
    await sb.from('signal_room_sessions').insert({
      workspace_id: r.workspace_id,
      room_id: r.id,
      session_id: session_id || null,
      pair, direction, timeframe: 'M' + (Number(expiration_minutes) || 1),
      entry_amount: investment, payout_pct: payout, profit,
      open_time: new Date().toISOString(),
      expiration_at: new Date().toISOString(),
      entry_price: open_price, exit_price: close_price,
      result, status: 'result_sent',
      quotex_trade_id, result_message_id: sent?.message_id,
      result_sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, message_id: sent?.message_id });
  } catch (err: any) {
    console.error('[trade-result]', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
