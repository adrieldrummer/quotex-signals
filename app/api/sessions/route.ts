// GET lista sessões, POST cria nova sessão
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { workspaceId } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULTS = {
  name: 'Nova Sessão',
  start_time: '09:00',
  end_time: '11:00',
  weekdays: [1,2,3,4,5],
  signal_count: 6,
  max_losses: 3,
  gale_levels: 2,
  schedule_mode: 'auto',
  fixed_times: [],
  timeframes: ['M5'],
  strategy: 'rsi_oversold_overbought',
  min_confidence: 65,
  cooldown_minutes: 5,
  use_all_assets: false,
  asset_categories: ['OTC'],
  assets: [],
  signal_type: 'message',
  is_active: true,
};

export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb.from('signal_sessions').select('*, channels(title, username)')
    .eq('workspace_id', workspaceId())
    .order('start_time', { ascending: true });
  return NextResponse.json(data || []);
}

export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const body = await req.json();
  // Pega channel padrão se não passar
  let channel_id = body.channel_id;
  if (!channel_id) {
    const { data: ch } = await sb.from('channels').select('id').eq('workspace_id', workspaceId()).limit(1).single();
    channel_id = ch?.id;
  }
  const insert = {
    ...DEFAULTS, ...body,
    workspace_id: workspaceId(),
    channel_id,
  };
  // Garante que arrays viram JSONB
  for (const k of ['weekdays','fixed_times','timeframes','asset_categories','assets']) {
    if (Array.isArray(insert[k])) insert[k] = JSON.stringify(insert[k]);
  }
  const { data, error } = await sb.from('signal_sessions').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
