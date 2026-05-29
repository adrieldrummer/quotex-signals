import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export default async function Home() {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (data.user) redirect('/dashboard');
  redirect('/login');
}
