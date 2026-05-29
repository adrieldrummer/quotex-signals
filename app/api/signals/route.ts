// GET lista, POST cria sala
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseServer();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  const { data } = await sb
    .from('signal_rooms')
    .select('*, channels(title, username), signal_room_bridge_state(last_seen, status, account_balance, signals_today, signals_today_date)')
    .order('created_at', { ascending: false });

  const now = Date.now();
  const rooms = (data || []).map((r: any) => {
    const bs = Array.isArray(r.signal_room_bridge_state) ? r.signal_room_bridge_state[0] : r.signal_room_bridge_state;
    return {
      ...r,
      channel_title: r.channels?.title || null,
      channel_username: r.channels?.username || null,
      bridge_last_seen: bs?.last_seen || null,
      bridge_online: bs?.last_seen ? (now - new Date(bs.last_seen).getTime()) < 120_000 : false,
      bridge_balance: bs?.account_balance || null,
      bridge_signals_today: bs?.signals_today_date === new Date().toISOString().slice(0,10) ? bs?.signals_today : 0,
    };
  });
  return NextResponse.json(rooms);
}

export async function POST(req: Request) {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  // workspace do usuário
  const { data: ws } = await sb.from('workspaces').select('id').eq('owner_id', u.user.id).limit(1).single();
  if (!ws) return NextResponse.json({ error: 'workspace não encontrado' }, { status: 400 });

  const body = await req.json();
  const insert: any = {
    workspace_id: ws.id,
    channel_id: body.channel_id || null,
    name: body.name || 'Sala VIP',
    mode: body.mode || 'simulated',
    schedule_times: body.schedule_times,
    schedule_weekdays: body.schedule_weekdays,
    pairs: body.pairs,
    use_otc: body.use_otc !== false,
    timeframe: body.timeframe || 'M1',
    gale_levels: body.gale_levels ?? 1,
    payout_min: body.payout_min ?? 85, payout_max: body.payout_max ?? 94,
    amount_min: body.amount_min ?? 100, amount_max: body.amount_max ?? 300,
    win_rate: body.win_rate ?? 85,
    strategy: body.strategy || 'rsi_oversold_overbought',
    strategy_params: body.strategy_params || {},
    cooldown_minutes: body.cooldown_minutes ?? 5,
    min_confidence: body.min_confidence ?? 60,
    cta_link: body.cta_link || null, cta_text: body.cta_text || null,
    ai_prompt: body.ai_prompt || null,
    is_active: body.is_active !== false,
  };

  const { data, error } = await sb.from('signal_rooms').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
