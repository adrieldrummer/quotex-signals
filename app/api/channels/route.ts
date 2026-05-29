// Lista canais + conecta novo canal (valida via Telegram getChat)
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getChat } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const { data } = await sb.from('channels').select('*').order('created_at', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  const { channel_identifier, default_cta_link, default_cta_text } = await req.json();
  if (!channel_identifier) return NextResponse.json({ error: 'channel_identifier obrigatório' }, { status: 400 });

  const { data: ws } = await sb.from('workspaces').select('*').eq('owner_id', u.user.id).single();
  if (!ws?.telegram_bot_token) return NextResponse.json({ error: 'configure bot token primeiro em /settings' }, { status: 400 });

  let chat;
  try { chat = await getChat(ws.telegram_bot_token, channel_identifier); }
  catch (err: any) { return NextResponse.json({ error: `Não acessei o canal: ${err.message}` }, { status: 400 }); }

  if (chat.type !== 'channel') return NextResponse.json({ error: `É "${chat.type}", precisa ser canal` }, { status: 400 });

  const { data, error } = await sb.from('channels').upsert({
    workspace_id: ws.id, telegram_chat_id: chat.id, title: chat.title,
    username: chat.username || null, default_cta_link, default_cta_text,
  }, { onConflict: 'workspace_id,telegram_chat_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
