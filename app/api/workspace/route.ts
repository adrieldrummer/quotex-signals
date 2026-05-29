// GET workspace do usuário, PATCH atualiza bot token / settings
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const { data } = await sb.from('workspaces').select('*').eq('owner_id', u.user.id).maybeSingle();
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const sb = supabaseServer();
  const body = await req.json();
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.telegram_bot_token !== undefined) updates.telegram_bot_token = body.telegram_bot_token;
  if (body.telegram_bot_username !== undefined) updates.telegram_bot_username = body.telegram_bot_username;
  if (body.twelvedata_api_key !== undefined) updates.twelvedata_api_key = body.twelvedata_api_key;
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const { data, error } = await sb.from('workspaces').update(updates).eq('owner_id', u.user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
