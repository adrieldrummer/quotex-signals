'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  TrendingUp, Plus, Trash2, Loader2, X, Settings, Activity, CheckCircle2,
  XCircle, Zap, Clock, Image as ImageIcon, Sparkles, Radio, Webhook, Copy,
  Wifi, WifiOff, Terminal, DollarSign, LogOut, Cog,
} from 'lucide-react';

const DEFAULT_PAIRS = ['EUR/USD','GBP/USD','USD/JPY','AUD/USD','EUR/JPY','EUR/GBP','USD/CAD','AUD/CAD'];
const DEFAULT_TIMES = ['09:00','09:35','10:10','10:45','14:15','14:50','19:00','19:35'];
const WEEKDAYS = [{v:1,l:'Seg'},{v:2,l:'Ter'},{v:3,l:'Qua'},{v:4,l:'Qui'},{v:5,l:'Sex'},{v:6,l:'Sáb'},{v:0,l:'Dom'}];

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
  return r.json();
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [ws, setWs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { reload(); const t = setInterval(() => {
    api('/signals').then(setRooms).catch(()=>{});
  }, 15000); return () => clearInterval(t); }, []);

  async function reload() {
    setLoading(true);
    try {
      const [r, c, w] = await Promise.all([api('/signals'), api('/channels'), api('/workspace')]);
      setRooms(r); setChannels(c); setWs(w);
    } finally { setLoading(false); }
  }

  async function dispatchNow(id: number) {
    if (!confirm('Disparar sessão de sinal agora?')) return;
    try { await api(`/signals/${id}/dispatch`, { method: 'POST' }); alert('Disparado!'); reload(); }
    catch (e: any) { alert(e.message); }
  }
  async function removeRoom(id: number) {
    if (!confirm('Apagar essa sala?')) return;
    await api(`/signals/${id}`, { method: 'DELETE' }); reload();
  }
  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-bg-border bg-bg-surface/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" />
            <h1 className="text-lg font-bold">Quotex Signals</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-white" title="Configurações">
              <Cog size={18} />
            </button>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-white" title="Sair">
              <LogOut size={18} />
            </button>
            <button onClick={() => setEditing('new')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold text-sm">
              <Plus size={14} /> Nova sala
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Carregando...</div>
        ) : !ws?.telegram_bot_token ? (
          <FirstStep onOpenSettings={() => setShowSettings(true)} />
        ) : rooms.length === 0 ? (
          <EmptyState channels={channels} onCreate={() => setEditing('new')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map(r => (
              <RoomCard key={r.id} room={r}
                onEdit={() => setEditing(r)}
                onDispatch={() => dispatchNow(r.id)}
                onDelete={() => removeRoom(r.id)} />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <EditorModal room={editing === 'new' ? null : editing} channels={channels}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
      {showSettings && (
        <SettingsModal ws={ws} onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); reload(); }} />
      )}
    </div>
  );
}

// ============================================================
function FirstStep({ onOpenSettings }: any) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-2xl p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
        <Cog size={32} className="text-white" />
      </div>
      <h2 className="text-xl font-bold mb-2">Configure seu Bot do Telegram primeiro</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        Crie um bot em @BotFather, copie o token, e conecte aqui. Depois liga um canal e cria as salas.
      </p>
      <button onClick={onOpenSettings} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold inline-flex items-center gap-2">
        <Cog size={16} /> Abrir configurações
      </button>
    </div>
  );
}

function EmptyState({ channels, onCreate }: any) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-2xl p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
        <TrendingUp size={32} className="text-white" />
      </div>
      <h2 className="text-xl font-bold mb-2">Crie sua primeira Sala de Sinais</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        Sistema 100% autônomo: posta sinais nos horários que você escolher, gera prints de resultado estilo Quotex.
      </p>
      {channels.length === 0 ? (
        <p className="text-amber-400 text-sm">⚠️ Conecte um canal primeiro nas Configurações</p>
      ) : (
        <button onClick={onCreate} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold inline-flex items-center gap-2">
          <Plus size={16} /> Criar sala agora
        </button>
      )}
    </div>
  );
}

// ============================================================
function RoomCard({ room, onEdit, onDispatch, onDelete }: any) {
  const winRate = room.total_sessions > 0 ? Math.round((room.total_wins / room.total_sessions) * 100) : null;
  const times = parseJ(room.schedule_times, []);
  const weekdays = parseJ(room.schedule_weekdays, []);

  return (
    <div className="bg-bg-surface border border-bg-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-bold text-lg flex items-center gap-2">
            {room.name}
            {room.is_active
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">ATIVA</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">PAUSADA</span>}
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">{labelMode(room.mode)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">#{room.channel_title || '—'}</div>
        </div>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-bg-base rounded-lg p-2">
          <div className="text-xs text-gray-500">Sessões</div>
          <div className="font-bold">{room.total_sessions || 0}</div>
        </div>
        <div className="bg-bg-base rounded-lg p-2">
          <div className="text-xs text-gray-500">Win rate</div>
          <div className="font-bold text-emerald-400">{winRate != null ? `${winRate}%` : '—'}</div>
        </div>
        <div className="bg-bg-base rounded-lg p-2">
          <div className="text-xs text-gray-500">Configurado</div>
          <div className="font-bold">{room.win_rate}%</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
        <Clock size={12} /> {times.length} horário(s) · {weekdays.length} dia(s) · {room.timeframe || 'M1'}
      </div>

      <BridgeBadge room={room} />

      <div className="flex gap-2 mt-3">
        <button onClick={onDispatch} className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
          <Zap size={14} /> Disparar agora
        </button>
        <button onClick={onEdit} className="px-3 py-2 bg-bg-base hover:bg-bg-base/70 border border-bg-border rounded-lg text-sm font-semibold flex items-center gap-1.5">
          <Settings size={14} /> Editar
        </button>
      </div>
    </div>
  );
}

function BridgeBadge({ room }: any) {
  if (!room.bridge_last_seen && room.mode !== 'live_analysis' && room.mode !== 'webhook') return null;
  if (!room.bridge_last_seen) {
    return (
      <div className="p-2 bg-bg-base border border-dashed border-bg-border rounded-lg flex items-center gap-2 text-xs text-gray-500">
        <Terminal size={12} /> Bridge desconectado — rode <code className="text-amber-400">python bridge.py</code>
      </div>
    );
  }
  const online = room.bridge_online;
  return (
    <div className={`p-2 rounded-lg border ${online ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold">
          {online ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-red-400" />}
          <span className={online ? 'text-emerald-400' : 'text-red-400'}>Bridge {online ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div className="text-gray-400">{room.bridge_signals_today || 0} sinal(is) hoje</div>
      </div>
      {room.bridge_balance != null && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
          <DollarSign size={11} /> ${Number(room.bridge_balance).toFixed(2)}
        </div>
      )}
    </div>
  );
}

// ============================================================
function EditorModal({ room, channels, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({
    name: room?.name || 'Sala VIP',
    channel_id: room?.channel_id || channels[0]?.id || null,
    schedule_times: parseJ(room?.schedule_times, DEFAULT_TIMES),
    schedule_weekdays: parseJ(room?.schedule_weekdays, [1,2,3,4,5]),
    pairs: parseJ(room?.pairs, DEFAULT_PAIRS.slice(0, 5)),
    use_otc: room?.use_otc ?? true,
    timeframe: room?.timeframe || 'M1',
    win_rate: room?.win_rate ?? 85,
    gale_levels: room?.gale_levels ?? 1,
    payout_min: room?.payout_min ?? 85, payout_max: room?.payout_max ?? 94,
    amount_min: room?.amount_min ?? 100, amount_max: room?.amount_max ?? 300,
    is_active: room?.is_active ?? true,
    cta_link: room?.cta_link || '', cta_text: room?.cta_text || '',
    mode: room?.mode || 'simulated',
    strategy: room?.strategy || 'rsi_oversold_overbought',
    cooldown_minutes: room?.cooldown_minutes ?? 5,
    min_confidence: room?.min_confidence ?? 60,
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('basics');

  function up(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.channel_id) return alert('Escolha o canal');
    if (form.pairs.length === 0) return alert('Pelo menos 1 par');
    if (form.schedule_times.length === 0 && form.mode === 'simulated') return alert('Pelo menos 1 horário');
    setSaving(true);
    try {
      if (room) await api(`/signals/${room.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      else await api('/signals', { method: 'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-bg-border rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" /> {room ? 'Editar sala' : 'Nova sala'}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex border-b border-bg-border px-6 gap-1 text-sm overflow-x-auto">
          {[
            { id: 'basics', l: 'Básico', i: Settings },
            { id: 'source', l: 'Fonte', i: Radio },
            { id: 'schedule', l: 'Horários', i: Clock },
            { id: 'result', l: 'Resultado', i: Activity },
            { id: 'preview', l: 'Preview', i: ImageIcon },
            ...(room ? [
              { id: 'bridge', l: 'Bridge Quotex', i: Terminal },
              { id: 'webhook', l: 'Webhook', i: Webhook },
              { id: 'sessions', l: 'Histórico', i: Sparkles },
            ] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 flex items-center gap-1.5 border-b-2 whitespace-nowrap ${tab === t.id ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
              <t.i size={14} /> {t.l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'basics' && <BasicsTab form={form} up={up} channels={channels} />}
          {tab === 'source' && <SourceTab form={form} up={up} />}
          {tab === 'schedule' && <ScheduleTab form={form} up={up} />}
          {tab === 'result' && <ResultTab form={form} up={up} />}
          {tab === 'preview' && room && <PreviewTab form={form} room={room} />}
          {tab === 'preview' && !room && <div className="text-gray-500">Salve a sala pra ver o preview.</div>}
          {tab === 'bridge' && room && <BridgeTab room={room} />}
          {tab === 'webhook' && room && <WebhookTab room={room} />}
          {tab === 'sessions' && room && <SessionsTab roomId={room.id} />}
        </div>

        <div className="px-6 py-4 border-t border-bg-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />}{room ? 'Salvar' : 'Criar sala'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BasicsTab({ form, up, channels }: any) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Nome da sala">
        <input value={form.name} onChange={e => up('name', e.target.value)} className="input" />
      </Field>
      <Field label="Canal Telegram">
        <select value={form.channel_id || ''} onChange={e => up('channel_id', Number(e.target.value))} className="input">
          <option value="">-- escolha --</option>
          {channels.map((c: any) => <option key={c.id} value={c.id}>{c.title} {c.username ? `(@${c.username})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Pares (separe por vírgula)">
        <input value={form.pairs.join(', ')}
          onChange={e => up('pairs', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
          className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeframe">
          <select value={form.timeframe} onChange={e => up('timeframe', e.target.value)} className="input">
            <option value="M1">M1 (1 min)</option><option value="M5">M5 (5 min)</option><option value="M15">M15 (15 min)</option>
          </select>
        </Field>
        <Field label="Gale">
          <select value={form.gale_levels} onChange={e => up('gale_levels', Number(e.target.value))} className="input">
            <option value={0}>Sem gale</option><option value={1}>Até G1</option><option value={2}>Até G2</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.use_otc} onChange={e => up('use_otc', e.target.checked)} />
        Adicionar "OTC" no par
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_active} onChange={e => up('is_active', e.target.checked)} />
        Sala ativa
      </label>
      <Field label="CTA — link (opcional)">
        <input value={form.cta_link} onChange={e => up('cta_link', e.target.value)} placeholder="https://..." className="input" />
      </Field>
      <Field label="CTA — texto do botão">
        <input value={form.cta_text} onChange={e => up('cta_text', e.target.value)} placeholder="🚀 Entrar VIP" className="input" />
      </Field>
    </div>
  );
}

function SourceTab({ form, up }: any) {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  useEffect(() => { api('/signals/strategies').then(setStrategies); }, []);

  async function test() {
    setTesting(true); setTestResult(null);
    try {
      const sp = new URLSearchParams({ pair: form.pairs[0] || 'EUR/USD', strategy: form.strategy, timeframe: form.timeframe });
      setTestResult(await api(`/signals/analyze?${sp}`));
    } catch (e: any) { setTestResult({ error: e.message }); }
    finally { setTesting(false); }
  }

  const sel = strategies.find(s => s.id === form.strategy);
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <div className="font-semibold mb-2">Fonte dos sinais</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { v: 'simulated', i: Zap, t: 'Simulado', d: 'Sorteia nos horários' },
            { v: 'live_analysis', i: Radio, t: 'Análise ao vivo', d: 'TwelveData + indicadores' },
            { v: 'webhook', i: Terminal, t: 'Webhook Quotex', d: 'pyquotex envia sinais' },
          ].map(m => (
            <button key={m.v} type="button" onClick={() => up('mode', m.v)}
              className={`text-left p-4 rounded-xl border-2 ${form.mode === m.v ? 'border-emerald-500 bg-emerald-500/10' : 'border-bg-border bg-bg-base'}`}>
              <div className="flex items-center gap-2 font-bold"><m.i size={16} /> {m.t}</div>
              <div className="text-xs text-gray-400 mt-1">{m.d}</div>
            </button>
          ))}
        </div>
      </div>

      {form.mode === 'live_analysis' && (
        <>
          <Field label="Estratégia">
            <select value={form.strategy} onChange={e => up('strategy', e.target.value)} className="input">
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {sel && <div className="text-xs text-gray-500 mt-1">{sel.description}</div>}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Confiança mínima: ${form.min_confidence}%`}>
              <input type="range" min="40" max="95" value={form.min_confidence} onChange={e => up('min_confidence', Number(e.target.value))} className="w-full" />
            </Field>
            <Field label="Cooldown (min)">
              <input type="number" value={form.cooldown_minutes} onChange={e => up('cooldown_minutes', Number(e.target.value))} className="input" />
            </Field>
          </div>
          <button type="button" onClick={test} disabled={testing}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            {testing && <Loader2 size={14} className="animate-spin" />}
            <Zap size={14} /> Testar agora ({form.pairs[0]})
          </button>
          {testResult && (
            <div className="bg-bg-base border border-bg-border rounded-lg p-3 text-sm font-mono">
              {testResult.error ? <div className="text-red-400">❌ {testResult.error}</div> : (
                <>
                  <div>Preço: <span className="text-white">{testResult.last_price}</span></div>
                  <div>Veredito: {testResult.verdict?.signal
                    ? <span className={testResult.verdict.signal === 'CALL' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{testResult.verdict.signal} ({testResult.verdict.confidence}%)</span>
                    : <span className="text-gray-500">sem sinal</span>}</div>
                  <div className="text-xs text-gray-500 mt-1">{testResult.verdict?.reason}</div>
                </>
              )}
            </div>
          )}
        </>
      )}
      {form.mode === 'webhook' && (
        <div className="bg-bg-base border border-bg-border rounded-lg p-3 text-sm text-gray-300">
          Modo webhook: rode <code className="text-cyan-400">python bridge.py</code> localmente. Sinais vêm direto da Quotex via pyquotex.
          Veja a aba "Bridge Quotex" depois de criar a sala.
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ form, up }: any) {
  function toggleDay(d: number) {
    up('schedule_weekdays', form.schedule_weekdays.includes(d)
      ? form.schedule_weekdays.filter((x: number) => x !== d)
      : [...form.schedule_weekdays, d].sort());
  }
  function addTime() {
    const t = prompt('HH:MM (Brasília):', '15:00');
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return;
    up('schedule_times', [...form.schedule_times, t].sort());
  }
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <div className="font-semibold mb-2">Dias da semana</div>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map(d => (
            <button type="button" key={d.v} onClick={() => toggleDay(d.v)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${form.schedule_weekdays.includes(d.v) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-bg-base border-bg-border text-gray-400'}`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold mb-2 flex items-center justify-between">
          <span>Horários (Brasília)</span>
          <button type="button" onClick={addTime} className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-1">
            <Plus size={12} /> Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.schedule_times.map((t: string) => (
            <span key={t} className="flex items-center gap-1.5 bg-bg-base border border-bg-border rounded-lg px-2.5 py-1 text-sm">
              <Clock size={12} className="text-emerald-400" /> {t}
              <button type="button" onClick={() => up('schedule_times', form.schedule_times.filter((x: string) => x !== t))} className="text-gray-500 hover:text-red-400 ml-1"><X size={12} /></button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultTab({ form, up }: any) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label={`Taxa de WIN simulada: ${form.win_rate}%`}>
        <input type="range" min="50" max="100" value={form.win_rate} onChange={e => up('win_rate', Number(e.target.value))} className="w-full" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payout min (%)"><input type="number" value={form.payout_min} onChange={e => up('payout_min', Number(e.target.value))} className="input" /></Field>
        <Field label="Payout max (%)"><input type="number" value={form.payout_max} onChange={e => up('payout_max', Number(e.target.value))} className="input" /></Field>
        <Field label="Entrada min ($)"><input type="number" value={form.amount_min} onChange={e => up('amount_min', Number(e.target.value))} className="input" /></Field>
        <Field label="Entrada max ($)"><input type="number" value={form.amount_max} onChange={e => up('amount_max', Number(e.target.value))} className="input" /></Field>
      </div>
    </div>
  );
}

function PreviewTab({ form, room }: any) {
  const [opts, setOpts] = useState({
    pair: form.pairs[0] + (form.use_otc ? ' OTC' : ''),
    direction: 'CALL', result: 'WIN',
    amount: Math.round((form.amount_min + form.amount_max) / 2),
    payout: Math.round((form.payout_min + form.payout_max) / 2),
    profit: 176.64, timeframe: form.timeframe,
  });
  const qs = new URLSearchParams(opts as any).toString();
  const src = `/api/signals/${room.id}/preview-print?${qs}&_t=${Date.now()}`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Field label="Par"><input value={opts.pair} onChange={e => setOpts({ ...opts, pair: e.target.value })} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direção">
            <select value={opts.direction} onChange={e => setOpts({ ...opts, direction: e.target.value })} className="input">
              <option>CALL</option><option>PUT</option>
            </select>
          </Field>
          <Field label="Resultado">
            <select value={opts.result} onChange={e => setOpts({ ...opts, result: e.target.value })} className="input">
              <option>WIN</option><option>LOSS</option>
            </select>
          </Field>
          <Field label="Valor"><input type="number" value={opts.amount} onChange={e => setOpts({ ...opts, amount: Number(e.target.value) })} className="input" /></Field>
          <Field label="Payout %"><input type="number" value={opts.payout} onChange={e => setOpts({ ...opts, payout: Number(e.target.value) })} className="input" /></Field>
          <Field label="Profit"><input type="number" value={opts.profit} onChange={e => setOpts({ ...opts, profit: Number(e.target.value) })} className="input" /></Field>
        </div>
      </div>
      <div className="bg-bg-base rounded-lg p-3">
        <img src={src} alt="preview" className="w-full rounded-lg" />
      </div>
    </div>
  );
}

function BridgeTab({ room }: any) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const envFile = `QUOTEX_EMAIL=seu_email@gmail.com
QUOTEX_PASSWORD=sua_senha
QUOTEX_ACCOUNT_TYPE=PRACTICE
WEBHOOK_BASE_URL=${baseUrl}
ROOM_ID=${room.id}
ROOM_SECRET=${room.webhook_secret}
PAIRS=EURUSD_otc,GBPUSD_otc,USDJPY_otc
STRATEGY=${room.strategy || 'rsi_oversold_overbought'}
MIN_CONFIDENCE=${room.min_confidence ?? 65}
COOLDOWN_SECONDS=${(room.cooldown_minutes ?? 5) * 60}`;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-bg-base border border-bg-border rounded-lg p-3 text-sm text-gray-300">
        📦 <strong>Setup local</strong> — o bridge Python roda na sua máquina/VPS (Vercel não tem Python). Pega <code className="text-amber-400">bridge/</code> do repo, instala deps (<code>pip install -r requirements.txt</code>), cola este .env e roda <code>python bridge.py</code>.
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-sm">Arquivo .env</span>
          <button onClick={() => navigator.clipboard.writeText(envFile)} className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1"><Copy size={12}/> Copiar</button>
        </div>
        <pre className="bg-bg-base border border-bg-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{envFile}</pre>
      </div>
    </div>
  );
}

function WebhookTab({ room }: any) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/api/signals/${room.id}/inject-signal`;
  const example = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"secret":"${room.webhook_secret}","pair":"EUR/USD OTC","direction":"CALL","entry_price":1.0852,"reason":"RSI<30","confidence":78}'`;
  return (
    <div className="space-y-4 max-w-3xl">
      <Field label="URL"><input readOnly value={url} className="input font-mono text-xs" /></Field>
      <Field label="Secret"><input readOnly value={room.webhook_secret} className="input font-mono text-xs" /></Field>
      <div>
        <div className="font-semibold text-sm mb-1">Exemplo curl</div>
        <pre className="bg-bg-base border border-bg-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{example}</pre>
      </div>
    </div>
  );
}

function SessionsTab({ roomId }: any) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api(`/signals/${roomId}/sessions`).then(setSessions).finally(() => setLoading(false)); }, [roomId]);
  if (loading) return <Loader2 className="animate-spin" />;
  if (!sessions.length) return <div className="text-gray-500">Sem sessões ainda.</div>;
  return (
    <div className="space-y-2">
      {sessions.map(s => (
        <div key={s.id} className="flex items-center gap-3 bg-bg-base border border-bg-border rounded-lg p-3">
          {s.result === 'WIN' ? <CheckCircle2 className="text-emerald-400" size={20} />
            : s.result === 'LOSS' ? <XCircle className="text-red-400" size={20} />
            : <Loader2 className="animate-spin text-gray-500" size={20} />}
          <div className="flex-1">
            <div className="font-semibold text-sm">{s.pair} · {s.direction}</div>
            <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString('pt-BR')}</div>
            {s.analysis_reason && <div className="text-xs text-cyan-400 mt-0.5">{s.analysis_reason}</div>}
          </div>
          <div className={`font-bold text-sm ${s.profit > 0 ? 'text-emerald-400' : s.profit < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {s.profit != null ? `${s.profit > 0 ? '+' : ''}$${Number(s.profit).toFixed(2)}` : '...'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
function SettingsModal({ ws, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({
    name: ws?.name || '',
    telegram_bot_token: ws?.telegram_bot_token || '',
    twelvedata_api_key: ws?.twelvedata_api_key || '',
  });
  const [saving, setSaving] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [channelMsg, setChannelMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try { await api('/workspace', { method: 'PATCH', body: JSON.stringify(form) }); onSaved(); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }
  async function connectChannel() {
    setChannelMsg(null);
    try {
      await api('/channels', { method: 'POST', body: JSON.stringify({ channel_identifier: channelInput }) });
      setChannelMsg('✅ Canal conectado!'); setChannelInput('');
    } catch (e: any) { setChannelMsg('❌ ' + e.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-bg-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2"><Cog size={20} className="text-emerald-400" /> Configurações</div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <Field label="Nome do workspace">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
          </Field>
          <Field label="Token do Bot Telegram">
            <input value={form.telegram_bot_token} onChange={e => setForm({ ...form, telegram_bot_token: e.target.value })}
              placeholder="12345:ABCdef..." className="input font-mono text-xs" />
            <div className="text-xs text-gray-500 mt-1">Crie em @BotFather no Telegram. Mantenha em segredo.</div>
          </Field>
          <Field label="TwelveData API Key (modo análise ao vivo)">
            <input value={form.twelvedata_api_key} onChange={e => setForm({ ...form, twelvedata_api_key: e.target.value })}
              placeholder="abc123..." className="input font-mono text-xs" />
            <div className="text-xs text-gray-500 mt-1">Free em <code>twelvedata.com</code>. 800 reqs/dia.</div>
          </Field>

          <div className="pt-4 border-t border-bg-border">
            <div className="font-semibold mb-2">Conectar canal Telegram</div>
            <div className="flex gap-2">
              <input value={channelInput} onChange={e => setChannelInput(e.target.value)}
                placeholder="@canal_vip ou -100123..." className="input flex-1" />
              <button onClick={connectChannel} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">Conectar</button>
            </div>
            <div className="text-xs text-gray-500 mt-1">⚠️ O bot precisa ser <strong>administrador</strong> do canal.</div>
            {channelMsg && <div className="text-sm mt-2">{channelMsg}</div>}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-bg-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function Field({ label, children }: any) {
  return (
    <label className="block">
      <div className="text-xs text-gray-400 mb-1 font-semibold">{label}</div>
      {children}
    </label>
  );
}
function parseJ(v: any, fb: any) {
  if (Array.isArray(v)) return v;
  if (!v) return fb;
  try { return JSON.parse(v); } catch { return fb; }
}
function labelMode(m: string) { return m === 'simulated' ? 'SIMULADO' : m === 'live_analysis' ? 'AO VIVO' : 'WEBHOOK'; }
