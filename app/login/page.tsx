'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { TrendingUp, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = supabaseBrowser();
    try {
      const fn = mode === 'signup' ? sb.auth.signUp({ email, password }) : sb.auth.signInWithPassword({ email, password });
      const { error } = await fn;
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-bg-surface border border-bg-border rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quotex Signals</h1>
            <p className="text-xs text-gray-400">Sala de sinais autônoma</p>
          </div>
        </div>

        <div className="flex gap-1 mb-5 bg-bg-base rounded-lg p-1">
          {[{ k: 'signin', l: 'Entrar' }, { k: 'signup', l: 'Criar conta' }].map(t => (
            <button key={t.k} onClick={() => setMode(t.k as any)}
              className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === t.k ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}>
              {t.l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-semibold">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-bg-base border border-bg-border rounded-lg" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block font-semibold">Senha</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg-base border border-bg-border rounded-lg" />
          </div>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</div>}
          <button disabled={loading} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
