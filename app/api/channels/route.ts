import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { workspaceId } from '@/lib/workspace';
import { getChat } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb.from('channels').select('*').eq('workspace_id', workspaceId()).order('created_at', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const { channel_identifier, default_cta_link, default_cta_text } = await req.json();
  if (!channel_identifier) return NextResponse.json({ error: 'channel_identifier obrigatório' }, { status: 400 });
  const sb = supabaseAdmin();
  const { data: ws } = await sb.from('workspaces').select('*').eq('id', workspaceId()).single();
  if (!ws?.telegram_bot_token) return NextResponse.json({ error: 'configure bot token primeiro em ⚙️' }, { status: 400 });

  let chat;
  try { chat = await getChat(ws.telegram_bot_token, channel_identifier); }
  catch (err: any) { return NextResponse.json({ error: `Não acessei o canal: ${err.message}` }, { status: 400 }); }
  if (chat.type !== 'channel') return NextResponse.json({ error: `É "${chat.type}", precisa ser canal` }, { status: 400 });

  const { data, error } = await sb.from('channels').upsert({
    workspace_id: workspaceId(), telegram_chat_id: chat.id, title: chat.title,
    username: chat.username || null, default_cta_link, default_cta_text,
  }, { onConflict: 'workspace_id,telegram_chat_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
