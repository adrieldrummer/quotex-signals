import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { runSession } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  // RLS já garante que esse user é dono
  const { data: room } = await sb.from('signal_rooms').select('id').eq('id', params.id).maybeSingle();
  if (!room) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const session = await runSession(Number(params.id));
    return NextResponse.json({ ok: true, session_id: session?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
