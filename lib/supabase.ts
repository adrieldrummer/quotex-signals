import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createBaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente Browser — usa cookies do Next (auth via SSR helpers) */
export function supabaseBrowser() {
  return createBrowserClient(URL, ANON);
}

/** Cliente Server — RSC/API routes, mantem sessão do usuário */
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      get(name) { return cookieStore.get(name)?.value; },
      set(name, value, options) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name, options) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
}

/** Admin client — usa service_role, bypass RLS. SÓ em endpoints de cron/webhook. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createBaseClient(URL, key, { auth: { persistSession: false } });
}
