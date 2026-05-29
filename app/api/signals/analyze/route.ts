import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCandles } from '@/lib/marketData';
import { analyze } from '@/lib/ta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: 'auth' }, { status: 401 });

  try {
    const sp = req.nextUrl.searchParams;
    const pair = sp.get('pair') || 'EUR/USD';
    const strategy = sp.get('strategy') || 'rsi_oversold_overbought';
    const interval = ({ M1: '1min', M5: '5min', M15: '15min' } as any)[sp.get('timeframe') || 'M1'] || '1min';
    const candles = await getCandles(pair, interval, 60);
    const verdict = analyze(candles, strategy);
    return NextResponse.json({
      pair, strategy, interval,
      last_price: candles[candles.length - 1]?.close,
      candles_count: candles.length,
      verdict,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
