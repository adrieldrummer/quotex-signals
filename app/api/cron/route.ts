// Cron Vercel — chamado a cada 1min via vercel.json
// Autentica pelo header Authorization: Bearer CRON_SECRET (Vercel envia automaticamente)
import { NextResponse } from 'next/server';
import { processScheduledRooms, processLiveRooms, processDueFollowups } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel cron passa este header
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const result: any = {};
  try { await processScheduledRooms(); result.scheduled = 'ok'; }
  catch (err: any) { result.scheduled_error = err.message; }

  try { await processLiveRooms(); result.live = 'ok'; }
  catch (err: any) { result.live_error = err.message; }

  try { await processDueFollowups(); result.followups = 'ok'; }
  catch (err: any) { result.followups_error = err.message; }

  result.ms = Date.now() - start;
  return NextResponse.json(result);
}
