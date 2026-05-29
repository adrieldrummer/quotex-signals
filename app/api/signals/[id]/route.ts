import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { workspaceId } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  const { data } = await sb.from('signal_rooms').select('*, channels(title, username)')
    .eq('id', params.id).eq('workspace_id', workspaceId()).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  const body = await req.json();
  delete body.id; delete body.workspace_id; delete body.webhook_secret;
  const { data, error } = await sb.from('signal_rooms').update(body)
    .eq('id', params.id).eq('workspace_id', workspaceId()).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  await sb.from('signal_rooms').delete().eq('id', params.id).eq('workspace_id', workspaceId());
  return NextResponse.json({ ok: true });
}
