import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { renderResultPng } from '@/lib/printGen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const png = await renderResultPng({
    pair: sp.get('pair') || 'AUD/USD OTC',
    direction: (sp.get('direction') || 'CALL').toUpperCase() as any,
    amount: Number(sp.get('amount')) || 192,
    payout: Number(sp.get('payout')) || 92,
    profit: Number(sp.get('profit')) || 176.64,
    result: (sp.get('result') || 'WIN').toUpperCase() as any,
    timeframe: sp.get('timeframe') || 'M1',
    openTime: new Date(Date.now() - 60_000),
    closingTime: new Date(),
  });
  return new NextResponse(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
