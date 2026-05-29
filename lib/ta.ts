// Indicadores técnicos puros + estratégias. Sem dep externa.

export type Candle = { open: number; high: number; low: number; close: number };
export type Verdict = {
  signal: 'CALL' | 'PUT' | null;
  confidence: number;
  reason: string;
  indicators: Record<string, any>;
};

export function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  let avgG = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgL = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out: number[] = [avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)];
  for (let i = period; i < gains.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
    out.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9) {
  if (closes.length < slow + signalP) return { line: [] as number[], signal: [] as number[], hist: [] as number[] };
  const ef = ema(closes, fast), es = ema(closes, slow);
  const offset = slow - fast;
  const aligned = ef.slice(offset);
  const line = aligned.map((v, i) => v - es[i]);
  const sig = ema(line, signalP);
  const histOff = line.length - sig.length;
  const hist = sig.map((s, i) => line[i + histOff] - s);
  return { line: line.slice(histOff), signal: sig, hist };
}

export function detectCandlePattern(candles: Candle[]): string | null {
  if (candles.length < 2) return null;
  const c = candles[candles.length - 1], p = candles[candles.length - 2];
  const body = Math.abs(c.close - c.open), range = c.high - c.low;
  const upper = c.high - Math.max(c.open, c.close), lower = Math.min(c.open, c.close) - c.low;
  if (range === 0) return null;
  if (body / range < 0.1) return 'doji';
  const cBull = c.close > c.open, pBull = p.close > p.open;
  const pBody = Math.abs(p.close - p.open);
  if (cBull && !pBull && c.close > p.open && c.open < p.close && body > pBody) return 'bullish_engulfing';
  if (!cBull && pBull && c.close < p.open && c.open > p.close && body > pBody) return 'bearish_engulfing';
  if (body / range < 0.3) {
    if (lower > body * 2 && upper < body) return 'hammer';
    if (upper > body * 2 && lower < body) return 'shooting_star';
  }
  return null;
}

// =====================================================
// Estratégias
// =====================================================
export const STRATEGIES = {
  rsi_oversold_overbought: {
    name: 'RSI sobrecompra/sobrevenda',
    description: 'RSI<30 → CALL, RSI>70 → PUT',
    minCandles: 30,
    analyze(candles: Candle[]): Verdict {
      const closes = candles.map(c => c.close);
      const r = rsi(closes, 14);
      if (!r.length) return { signal: null, confidence: 0, reason: 'sem dados', indicators: {} };
      const last = r[r.length - 1];
      if (last < 30) return { signal: 'CALL', confidence: Math.round(100 - (last / 30) * 100),
        reason: `RSI=${last.toFixed(1)} < 30 (sobrevenda)`, indicators: { rsi: last } };
      if (last > 70) return { signal: 'PUT', confidence: Math.round(((last - 70) / 30) * 100),
        reason: `RSI=${last.toFixed(1)} > 70 (sobrecompra)`, indicators: { rsi: last } };
      return { signal: null, confidence: 0, reason: `RSI=${last.toFixed(1)} neutro`, indicators: { rsi: last } };
    },
  },
  ema_crossover: {
    name: 'EMA crossover',
    description: 'EMA9 cruza EMA21',
    minCandles: 30,
    analyze(candles: Candle[]): Verdict {
      const closes = candles.map(c => c.close);
      const ef = ema(closes, 9), es = ema(closes, 21);
      if (ef.length < 2 || es.length < 2) return { signal: null, confidence: 0, reason: 'sem dados', indicators: {} };
      const aligned = ef.slice(21 - 9);
      const lf = aligned[aligned.length - 1], pf = aligned[aligned.length - 2];
      const ls = es[es.length - 1], ps = es[es.length - 2];
      const up = pf <= ps && lf > ls, down = pf >= ps && lf < ls;
      const spread = Math.abs(lf - ls) / ls * 10000;
      if (up) return { signal: 'CALL', confidence: Math.min(95, 50 + Math.round(spread * 5)),
        reason: `EMA9 cruzou EMA21 pra cima (+${spread.toFixed(1)}pip)`, indicators: { emaFast: lf, emaSlow: ls } };
      if (down) return { signal: 'PUT', confidence: Math.min(95, 50 + Math.round(spread * 5)),
        reason: `EMA9 cruzou EMA21 pra baixo (-${spread.toFixed(1)}pip)`, indicators: { emaFast: lf, emaSlow: ls } };
      return { signal: null, confidence: 0, reason: 'sem cruzamento', indicators: { emaFast: lf, emaSlow: ls } };
    },
  },
  multi_confluence: {
    name: 'Multi-confluência',
    description: 'RSI + MACD + padrão de candle (≥2 concordam)',
    minCandles: 40,
    analyze(candles: Candle[]): Verdict {
      const closes = candles.map(c => c.close);
      const r = rsi(closes, 14), m = macd(closes), p = detectCandlePattern(candles);
      const lastR = r[r.length - 1], lastH = m.hist[m.hist.length - 1], prevH = m.hist[m.hist.length - 2];
      const votes: string[] = [], reasons: string[] = [];
      if (lastR < 30) { votes.push('CALL'); reasons.push(`RSI ${lastR.toFixed(1)} oversold`); }
      else if (lastR > 70) { votes.push('PUT'); reasons.push(`RSI ${lastR.toFixed(1)} overbought`); }
      if (prevH != null && lastH != null) {
        if (prevH <= 0 && lastH > 0) { votes.push('CALL'); reasons.push('MACD hist+'); }
        else if (prevH >= 0 && lastH < 0) { votes.push('PUT'); reasons.push('MACD hist-'); }
      }
      if (p === 'bullish_engulfing' || p === 'hammer') { votes.push('CALL'); reasons.push(`candle ${p}`); }
      else if (p === 'bearish_engulfing' || p === 'shooting_star') { votes.push('PUT'); reasons.push(`candle ${p}`); }
      const calls = votes.filter(v => v === 'CALL').length, puts = votes.filter(v => v === 'PUT').length;
      const ind = { rsi: lastR, macdHist: lastH, pattern: p };
      if (calls >= 2 && calls > puts) return { signal: 'CALL', confidence: Math.min(95, 60 + calls * 10),
        reason: `${calls}/3 CALL: ${reasons.join(', ')}`, indicators: ind };
      if (puts >= 2 && puts > calls) return { signal: 'PUT', confidence: Math.min(95, 60 + puts * 10),
        reason: `${puts}/3 PUT: ${reasons.join(', ')}`, indicators: ind };
      return { signal: null, confidence: 0, reason: 'sem confluência', indicators: ind };
    },
  },
};

export function analyze(candles: Candle[], strategyType: string): Verdict {
  const s = (STRATEGIES as any)[strategyType];
  if (!s) throw new Error(`Estratégia desconhecida: ${strategyType}`);
  if (candles.length < s.minCandles) return { signal: null, confidence: 0, reason: `precisa ≥${s.minCandles} candles`, indicators: {} };
  return s.analyze(candles);
}

export function listStrategies() {
  return Object.entries(STRATEGIES).map(([id, s]) => ({ id, name: s.name, description: s.description, minCandles: s.minCandles }));
}
