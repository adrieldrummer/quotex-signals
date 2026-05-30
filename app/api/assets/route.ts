// Retorna ativos Quotex ao vivo (Aberto/Fechado/payout) — vindo do bridge.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { workspaceId } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb.from('workspace_assets').select('assets, updated_at')
    .eq('workspace_id', workspaceId()).maybeSingle();
  const age = data?.updated_at ? Math.round((Date.now() - new Date(data.updated_at).getTime()) / 1000) : null;
  return NextResponse.json({
    assets: data?.assets || [],
    updated_at: data?.updated_at || null,
    age_seconds: age,
    is_fresh: age != null && age < 120,
  });
}
