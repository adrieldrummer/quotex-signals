import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { workspaceId } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb.from('workspaces').select('*').eq('id', workspaceId()).maybeSingle();
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const updates: any = {};
  for (const k of ['name','telegram_bot_token','telegram_bot_username','twelvedata_api_key']) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('workspaces').update(updates).eq('id', workspaceId()).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
