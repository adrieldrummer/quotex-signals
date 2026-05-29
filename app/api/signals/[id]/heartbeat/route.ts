// Heartbeat do bridge Python (sem JWT, valida com secret)
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { secret, status, version, account_balance, account_email, account_type, pairs_watching, last_error } = body || {};
    if (!secret) return NextResponse.json({ error: 'secret obrigatório' }, { status: 401 });

    const sb = supabaseAdmin();
    const { data: room } = await sb.from('signal_rooms').select('id, webhook_secret').eq('id', params.id).maybeSingle();
    if (!room) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 });
    if (room.webhook_secret !== secret) return NextResponse.json({ error: 'secret inválido' }, { status: 403 });

    const today = new Date().toISOString().slice(0, 10);
    const { data: prev } = await sb.from('signal_room_bridge_state')
      .select('signals_today, signals_today_date').eq('room_id', room.id).maybeSingle();
    const sameDay = prev?.signals_today_date === today;

    await sb.from('signal_room_bridge_state').upsert({
      room_id: room.id,
      last_seen: new Date().toISOString(),
      status: status || 'online',
      version: version || null,
      account_balance: account_balance ?? null,
      account_email: account_email || null,
      account_type: account_type || null,
      pairs_watching: pairs_watching || [],
      last_error: last_error || null,
      signals_today: sameDay ? prev!.signals_today : 0,
      signals_today_date: today,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'room_id' });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
