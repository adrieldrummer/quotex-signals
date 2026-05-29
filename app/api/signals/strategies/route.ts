import { NextResponse } from 'next/server';
import { listStrategies } from '@/lib/ta';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(listStrategies());
}
