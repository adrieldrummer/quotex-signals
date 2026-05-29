import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data } = await sb
    .from('signal_room_sessions').select('*')
    .eq('room_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
