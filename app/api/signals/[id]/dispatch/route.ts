import { NextResponse } from 'next/server';
import { runSession } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await runSession(Number(params.id));
    return NextResponse.json({ ok: true, session_id: session?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
