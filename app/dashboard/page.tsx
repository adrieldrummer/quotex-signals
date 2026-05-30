'use client';
import { useEffect, useState } from 'react';
import {
  TrendingUp, Plus, Trash2, Loader2, X, Cog, Wifi, WifiOff, DollarSign,
  Clock, Target, ShieldAlert, Layers, ChevronDown, ChevronUp,
} from 'lucide-react';

const WEEKDAYS = [
  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 0, l: 'Dom' },
];
const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M15', 'M30'];
const CATEGORIES = ['Forex', 'Cripto', 'Ações', 'OTC'];

async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
  return r.json();
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [bridgeStatus, setBridgeStatus] = useState<any>(null);
  const [ws, setWs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    reload();
    const t = setInterval(() => {
      api('/signals').then(rooms => setBridgeStatus(rooms[0] || null)).catch(() => {});
      api('/sessions').then(setSessions).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const [s, w, r] = await Promise.all([api('/sessions'), api('/workspace'), api('/signals')]);
      setSessions(s); setWs(w); setBridgeStatus(r[0] || null);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-bg-border bg-bg-surface/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" />
            <h1 className="text-lg font-bold">Quotex Signals</h1>
            <BridgePill status={bridgeStatus} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-white" title="Configurações">
              <Cog size={18} />
            </button>
            <button onClick={() => setEditingId('new')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold text-sm">
              <Plus size={14} /> Nova Sessão
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Carregando...</div>
        ) : !ws?.telegram_bot_token ? (
          <Empty title="Configure o Bot do Telegram" desc="Antes de criar sessões, conecte seu bot do Telegram." cta="Abrir configurações" onClick={() => setShowSettings(true)} />
        ) : sessions.length === 0 ? (
          <Empty title="Crie sua primeira Sessão" desc="Uma sessão é uma janela de operação (ex: 'Sessão da manhã 09:00-12:00'). Você configura horário, ativos, qtd de sinais e tudo mais." cta="Adicionar Janela" onClick={() => setEditingId('new')} />
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard key={s.id} session={s}
                onEdit={() => setEditingId(s.id)}
                onDelete={async () => { if (confirm(`Apagar sessão "${s.name}"?`)) { await api(`/sessions/${s.id}`, { method: 'DELETE' }); reload(); } }} />
            ))}
          </div>
        )}
      </main>

      {editingId && (
        <SessionEditor id={editingId} onClose={() => setEditingId(null)} onSaved={() => { setEditingId(null); reload(); }} />
      )}
      {showSettings && (
        <SettingsModal ws={ws} onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); reload(); }} />
      )}
    </div>
  );
}

// ============================================================
function BridgePill({ status }: { status: any }) {
  if (!status?.bridge_last_seen) return null;
  const online = status.bridge_online;
  return (
    <span className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {online ? <Wifi size={11} /> : <WifiOff size={11} />}
      {online ? 'Quotex ONLINE' : 'Quotex OFFLINE'}
      {status.bridge_balance != null && online && (
        <span className="text-gray-400">· ${Number(status.bridge_balance).toFixed(2)}</span>
      )}
    </span>
  );
}

function Empty({ title, desc, cta, onClick }: any) {
  return (
    <div className="bg-bg-surface border border-bg-border rounded-2xl p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
        <Layers size={32} className="text-white" />
      </div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">{desc}</p>
      <button onClick={onClick} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold inline-flex items-center gap-2">
        <Plus size={16} /> {cta}
      </button>
    </div>
  );
}

// ============================================================
function SessionCard({ session, onEdit, onDelete }: any) {
  const tf = parseJ(session.timeframes, []);
  const wd = parseJ(session.weekdays, []);
  const assets = parseJ(session.assets, []);
  const cats = parseJ(session.asset_categories, []);
  const status = session.is_active ? 'ATIVA' : 'PAUSADA';

  return (
    <div className="bg-bg-surface border border-bg-border rounded-xl p-4 hover:border-emerald-500/30 transition">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full ${session.is_active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          <div className="font-bold truncate">{session.name}</div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${session.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs px-3 py-1.5 bg-bg-base hover:bg-bg-base/70 border border-bg-border rounded-lg">Editar</button>
          <button onClick={onDelete} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <Stat icon={Clock} label="Janela" value={`${(session.start_time||'').slice(0,5)} → ${(session.end_time||'').slice(0,5)}`} />
        <Stat icon={Target} label="Sinais" value={session.signal_count} />
        <Stat icon={ShieldAlert} label="Stop" value={session.max_losses ? `${session.max_losses} losses` : 'ilimitado'} />
        <Stat icon={Layers} label="Gale" value={`G${session.gale_levels}`} />
        <Stat icon={TrendingUp} label="TF" value={tf.join(', ')} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
        <span>📅</span>
        {WEEKDAYS.filter(d => wd.includes(d.v)).map(d => (
          <span key={d.v} className="px-1.5 py-0.5 bg-bg-base rounded">{d.l}</span>
        ))}
        <span className="ml-2">🎯</span>
        {session.use_all_assets
          ? <span>Todos os ativos abertos</span>
          : assets.length > 0
            ? <span>{assets.length} ativo(s) · {cats.join(', ')}</span>
            : <span className="text-amber-400">⚠ sem ativos</span>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-bg-base rounded-lg p-2">
      <div className="flex items-center gap-1 text-gray-500"><Icon size={11} /> {label}</div>
      <div className="font-bold text-white">{value}</div>
    </div>
  );
}

// ============================================================
function SessionEditor({ id, onClose, onSaved }: any) {
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    name: 'Nova Sessão',
    start_time: '09:00', end_time: '11:00',
    weekdays: [1,2,3,4,5],
    signal_count: 6, max_losses: 3, gale_levels: 2,
    schedule_mode: 'auto', fixed_times: [],
    timeframes: ['M5'],
    strategy: 'rsi_oversold_overbought',
    min_confidence: 65, cooldown_minutes: 5,
    use_all_assets: false,
    asset_categories: ['OTC'],
    assets: [],
    signal_type: 'message',
    start_message: '🚀 Iniciamos a sessão! Bora pra cima 🔥',
    end_message: '✅ Sessão encerrada. Próxima em breve!',
    is_active: true,
  });
  const [assetsData, setAssetsData] = useState<{ assets: any[], age_seconds: number | null, is_fresh: boolean }>({ assets: [], age_seconds: null, is_fresh: false });
  const [showAssetsPicker, setShowAssetsPicker] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api(`/sessions/${id}`).then(d => {
        // normaliza
        ['weekdays','fixed_times','timeframes','asset_categories','assets'].forEach(k => { d[k] = parseJ(d[k], []); });
        d.start_time = (d.start_time || '09:00').slice(0,5);
        d.end_time = (d.end_time || '11:00').slice(0,5);
        setForm(d);
      }).finally(() => setLoading(false));
    }
    api('/assets').then(setAssetsData).catch(() => {});
  }, [id, isNew]);

  function up(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })); }
  function toggleArr(k: string, v: any) {
    const arr = form[k] || [];
    up(k, arr.includes(v) ? arr.filter((x: any) => x !== v) : [...arr, v]);
  }

  async function save() {
    setSaving(true);
    try {
      if (isNew) await api('/sessions', { method: 'POST', body: JSON.stringify(form) });
      else await api(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(form) });
      onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-bg-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2">
            <Layers size={20} className="text-emerald-400" /> {isNew ? 'Nova Sessão' : 'Editar Sessão'}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Linha 1: Nome + Início + Fim + Sinais + Losses + Gale */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <FieldCol label="Nome da Sessão" wide>
              <input value={form.name} onChange={e => up('name', e.target.value)} className="input" />
            </FieldCol>
            <FieldCol label="Início">
              <input type="time" value={form.start_time} onChange={e => up('start_time', e.target.value)} className="input" />
            </FieldCol>
            <FieldCol label="Fim">
              <input type="time" value={form.end_time} onChange={e => up('end_time', e.target.value)} className="input" />
            </FieldCol>
            <FieldCol label="Qtd. Sinais">
              <input type="number" min="1" value={form.signal_count} onChange={e => up('signal_count', Number(e.target.value))} className="input" />
            </FieldCol>
            <FieldCol label="Max Losses">
              <input type="number" min="0" value={form.max_losses} onChange={e => up('max_losses', Number(e.target.value))} className="input" />
            </FieldCol>
            <FieldCol label="Martingale">
              <select value={form.gale_levels} onChange={e => up('gale_levels', Number(e.target.value))} className="input">
                <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </FieldCol>
          </div>

          {/* Tipo + Agendamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="text-xs text-gray-400 mb-2 font-semibold">Tipo de Sinal</div>
              <Radio name="signal_type" value={form.signal_type} onChange={v => up('signal_type', v)} options={[
                { v: 'message', l: 'Mensagem' }, { v: 'list', l: 'Lista' },
              ]} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2 font-semibold">Agendamento</div>
              <Radio name="schedule_mode" value={form.schedule_mode} onChange={v => up('schedule_mode', v)} options={[
                { v: 'auto', l: 'Automático' }, { v: 'fixed', l: 'Horários fixos' },
              ]} />
              {form.schedule_mode === 'fixed' && (
                <div className="mt-2">
                  <input value={form.fixed_times.join(', ')}
                    onChange={e => up('fixed_times', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="ex: 09:15, 09:35, 10:00"
                    className="input text-xs" />
                </div>
              )}
            </div>
          </div>

          {/* Timeframes */}
          <div>
            <div className="text-xs text-gray-400 mb-2 font-semibold">Timeframes</div>
            <div className="flex gap-2 flex-wrap">
              {TIMEFRAMES.map(t => (
                <button key={t} type="button" onClick={() => toggleArr('timeframes', t)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${form.timeframes.includes(t) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-bg-base border-bg-border text-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dias da semana */}
          <div>
            <div className="text-xs text-gray-400 mb-2 font-semibold">Dias da Semana</div>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map(d => (
                <button key={d.v} type="button" onClick={() => toggleArr('weekdays', d.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${form.weekdays.includes(d.v) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-bg-base border-bg-border text-gray-400'}`}>
                  {d.l}.
                </button>
              ))}
            </div>
          </div>

          {/* Ativos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400 font-semibold">Ativos</div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.use_all_assets} onChange={e => up('use_all_assets', e.target.checked)} />
                Usar Todos os Ativos abertos
              </label>
            </div>
            {!form.use_all_assets && (
              <>
                <button onClick={() => setShowAssetsPicker(!showAssetsPicker)} className="w-full px-3 py-2 bg-bg-base border border-bg-border rounded-lg text-left text-sm hover:border-emerald-500/30 flex items-center justify-between">
                  <span>
                    {form.assets.length === 0
                      ? <span className="text-amber-400">Nenhum ativo selecionado</span>
                      : <>
                          <span className="font-bold text-white">{form.assets.length}</span>
                          <span className="text-gray-400 ml-1">ativo(s) — {form.asset_categories.join(', ')}</span>
                        </>}
                  </span>
                  {showAssetsPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showAssetsPicker && (
                  <AssetsPicker data={assetsData} form={form} up={up} toggleArr={toggleArr} />
                )}
              </>
            )}
          </div>

          {/* Estratégia + Confiança */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FieldCol label="Estratégia">
              <select value={form.strategy} onChange={e => up('strategy', e.target.value)} className="input">
                <option value="rsi_oversold_overbought">RSI sobrecompra/sobrevenda</option>
                <option value="ema_crossover">EMA Crossover</option>
                <option value="multi_confluence">Multi-confluência</option>
              </select>
            </FieldCol>
            <FieldCol label={`Confiança mínima: ${form.min_confidence}%`}>
              <input type="range" min="40" max="95" value={form.min_confidence} onChange={e => up('min_confidence', Number(e.target.value))} className="w-full mt-2" />
            </FieldCol>
            <FieldCol label="Cooldown (min)">
              <input type="number" value={form.cooldown_minutes} onChange={e => up('cooldown_minutes', Number(e.target.value))} className="input" />
            </FieldCol>
          </div>

          {/* Mensagens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldCol label="Mensagem de início da sessão">
              <textarea rows={3} value={form.start_message || ''} onChange={e => up('start_message', e.target.value)} className="input" />
            </FieldCol>
            <FieldCol label="Mensagem de fim da sessão">
              <textarea rows={3} value={form.end_message || ''} onChange={e => up('end_message', e.target.value)} className="input" />
            </FieldCol>
          </div>

          {/* CTA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FieldCol label="CTA — link (opcional)">
              <input value={form.cta_link || ''} onChange={e => up('cta_link', e.target.value)} placeholder="https://..." className="input" />
            </FieldCol>
            <FieldCol label="CTA — texto">
              <input value={form.cta_text || ''} onChange={e => up('cta_text', e.target.value)} placeholder="🚀 Entrar VIP" className="input" />
            </FieldCol>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => up('is_active', e.target.checked)} />
            Sessão ativa
          </label>
        </div>

        <div className="px-6 py-4 border-t border-bg-border flex justify-end gap-2 bg-bg-surface">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} {isNew ? 'Criar Sessão' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SELETOR VISUAL DE ATIVOS
// ============================================================
function AssetsPicker({ data, form, up, toggleArr }: any) {
  const fresh = data.is_fresh;
  const groups: Record<string, any[]> = {};
  for (const a of data.assets || []) {
    (groups[a.category] = groups[a.category] || []).push(a);
  }
  function categoryFilter(cat: string) {
    return form.asset_categories.includes(cat) || form.asset_categories.length === 0;
  }

  return (
    <div className="mt-3 bg-bg-base border border-bg-border rounded-lg p-3 space-y-3">
      {!fresh && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
          ⚠ Bridge offline ou dados velhos ({data.age_seconds != null ? `${data.age_seconds}s atrás` : 'sem dados'}). Rode <code>python bridge.py</code> pra ver os ativos ao vivo.
        </div>
      )}
      {/* Legenda */}
      <div className="flex flex-wrap gap-2 items-center text-[11px] text-gray-400 border-b border-bg-border pb-2">
        <span>Legenda:</span>
        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">Aberto</span>
        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-500 rounded">Fechado</span>
        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">80%</span> Payout &gt; 75%
        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">42%</span> Payout ≤ 75%
      </div>
      {/* Categorias rapidas */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => up('asset_categories', [...CATEGORIES])}
          className={`px-3 py-1 rounded-lg text-xs border ${form.asset_categories.length === 4 ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-bg-surface border-bg-border text-gray-300'}`}>Todos</button>
        {CATEGORIES.map(c => (
          <button key={c} type="button" onClick={() => toggleArr('asset_categories', c)}
            className={`px-3 py-1 rounded-lg text-xs border ${form.asset_categories.includes(c) ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-bg-surface border-bg-border text-gray-300'}`}>{c}</button>
        ))}
        <button type="button" onClick={() => { up('assets', []); }} className="px-3 py-1 rounded-lg text-xs border bg-bg-surface border-bg-border text-gray-400 ml-auto">× Limpar</button>
      </div>
      {/* Grid de ativos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto">
        {CATEGORIES.map(cat => categoryFilter(cat) && (
          <div key={cat}>
            <div className="font-bold text-xs text-gray-400 mb-2 sticky top-0 bg-bg-base py-1">{cat}</div>
            <div className="space-y-1">
              {(groups[cat] || []).map(a => {
                const checked = form.assets.includes(a.symbol);
                const payoutHigh = a.payout > 75;
                return (
                  <label key={a.symbol} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-bg-surface text-[12px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input type="checkbox" checked={checked} onChange={() => toggleArr('assets', a.symbol)} />
                      <span className="truncate">{a.name || a.symbol}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.is_open ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-500'}`}>
                        {a.is_open ? 'Aberto' : 'Fechado'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${payoutHigh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {a.payout}%
                      </span>
                    </div>
                  </label>
                );
              })}
              {(groups[cat] || []).length === 0 && <div className="text-xs text-gray-600 px-2">—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
function SettingsModal({ ws, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({
    name: ws?.name || '',
    telegram_bot_token: ws?.telegram_bot_token || '',
  });
  const [channels, setChannels] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [channelMsg, setChannelMsg] = useState<string | null>(null);

  useEffect(() => { api('/channels').then(setChannels).catch(()=>{}); }, []);

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
      api('/channels').then(setChannels);
    } catch (e: any) { setChannelMsg('❌ ' + e.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-bg-border rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-bg-border flex items-center justify-between">
          <div className="font-bold text-lg flex items-center gap-2"><Cog size={20} className="text-emerald-400" /> Configurações</div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <FieldCol label="Token do Bot Telegram">
            <input value={form.telegram_bot_token} onChange={e => setForm({ ...form, telegram_bot_token: e.target.value })} placeholder="123:ABC..." className="input font-mono text-xs" />
          </FieldCol>

          <div className="pt-2 border-t border-bg-border">
            <div className="font-semibold mb-2 text-sm">Canais conectados</div>
            <div className="space-y-1 mb-3">
              {channels.length === 0 && <div className="text-xs text-gray-500">Nenhum canal ainda.</div>}
              {channels.map(c => (
                <div key={c.id} className="text-sm bg-bg-base border border-bg-border rounded-lg px-3 py-2 flex items-center justify-between">
                  <span>📢 {c.title}{c.username ? ` (@${c.username})` : ''}</span>
                  <span className="text-xs text-gray-500">#{c.telegram_chat_id}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={channelInput} onChange={e => setChannelInput(e.target.value)} placeholder="@canal ou -100..." className="input flex-1" />
              <button onClick={connectChannel} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold">Conectar</button>
            </div>
            <div className="text-xs text-gray-500 mt-1">Bot precisa ser administrador do canal.</div>
            {channelMsg && <div className="text-sm mt-2">{channelMsg}</div>}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-bg-border flex justify-end gap-2 bg-bg-surface">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Fechar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
function FieldCol({ label, children, wide }: any) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <div className="text-xs text-gray-400 mb-1 font-semibold">{label}</div>
      {children}
    </div>
  );
}
function Radio({ name, value, onChange, options }: any) {
  return (
    <div className="flex gap-3">
      {options.map((o: any) => (
        <label key={o.v} className="flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.l}
        </label>
      ))}
    </div>
  );
}
function parseJ(v: any, fb: any) {
  if (Array.isArray(v)) return v;
  if (v == null) return fb;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return fb; }
}
