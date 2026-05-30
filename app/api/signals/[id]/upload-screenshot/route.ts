// Recebe screenshot REAL do bridge (Patchright) e posta no Telegram.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildHumanCopy } from '@/lib/humanCopy';
import { sendPhoto } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const form = await req.formData();
    const secret = String(form.get('secret') || '');
    const pair = String(form.get('pair') || '');
    const direction = String(form.get('direction') || 'CALL') as 'CALL' | 'PUT';
    const result = String(form.get('result') || 'PENDING') as 'WIN' | 'LOSS' | 'PENDING';
    const investment = Number(form.get('investment') || 0);
    const profit = Number(form.get('profit') || 0);
    const file = form.get('screenshot') as File | null;

    if (!secret) return NextResponse.json({ error: 'secret obrigatório' }, { status: 401 });
    if (!file) return NextResponse.json({ error: 'screenshot obrigatório' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: room } = await sb.from('signal_rooms')
      .select('id, workspace_id, webhook_secret, cta_link, cta_text, workspaces(telegram_bot_token), channels(telegram_chat_id)')
      .eq('id', params.id).maybeSingle();
    if (!room) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 });
    if (room.webhook_secret !== secret) return NextResponse.json({ error: 'secret inválido' }, { status: 403 });
    const r: any = room;
    const botToken: string = r.workspaces?.telegram_bot_token;
    const chatId: number = r.channels?.telegram_chat_id;
    if (!botToken || !chatId) return NextResponse.json({ error: 'sem bot/canal' }, { status: 400 });

    // bytes do PNG
    const buf = Buffer.from(await file.arrayBuffer());

    // caption
    let caption: string;
    if (result === 'PENDING') {
      const arrow = direction === 'CALL' ? '🟢 PARA CIMA' : '🔴 PARA BAIXO';
      caption = [
        '🎯 ENTRADA AO VIVO!',
        '',
        `${arrow} ${pair}`,
        `💵 Investido: ${investment} R$`,
        '',
        'Tô dentro — quem entrar comigo? 🔥',
      ].join('\n');
    } else {
      caption = buildHumanCopy({ result: result as any, pair, investment, profit, direction });
    }

    const sent = await sendPhoto(botToken, chatId, buf, caption, {
      reply_markup: r.cta_link ? { inline_keyboard: [[{ text: r.cta_text || '🚀 Operar comigo', url: r.cta_link }]] } : undefined,
    });

    return NextResponse.json({ ok: true, message_id: sent?.message_id });
  } catch (err: any) {
    console.error('[upload-screenshot]', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
