// Webhook público — bridge Python chama aqui sem JWT, valida com secret
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { injectSignal } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { secret, ...payload } = body || {};
    if (!secret) return NextResponse.json({ error: 'secret obrigatório' }, { status: 401 });

    const sb = supabaseAdmin();
    const { data: room } = await sb.from('signal_rooms').select('id, webhook_secret, is_active').eq('id', params.id).maybeSingle();
    if (!room) return NextResponse.json({ error: 'sala não encontrada' }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: 'sala pausada' }, { status: 400 });
    if (room.webhook_secret !== secret) return NextResponse.json({ error: 'secret inválido' }, { status: 403 });

    const session = await injectSignal(room.id, payload);

    // incrementa contador hoje
    const today = new Date().toISOString().slice(0, 10);
    const { data: prev } = await sb.from('signal_room_bridge_state')
      .select('signals_today, signals_today_date').eq('room_id', room.id).maybeSingle();
    const sameDay = prev?.signals_today_date === today;
    await sb.from('signal_room_bridge_state').upsert({
      room_id: room.id,
      last_signal_at: new Date().toISOString(),
      signals_today: sameDay ? (prev!.signals_today + 1) : 1,
      signals_today_date: today,
    }, { onConflict: 'room_id' });
    return NextResponse.json({ ok: true, session_id: session?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
