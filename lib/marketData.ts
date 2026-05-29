// TwelveData client com cache em memória.
import type { Candle } from './ta';

const BASE = 'https://api.twelvedata.com';
const cache = new Map<string, { at: number; data: Candle[] }>();
const TTL = 30_000;

export function normalizeSymbol(pair: string) {
  return String(pair).replace(/\s*OTC\s*$/i, '').trim().toUpperCase();
}

export async function getCandles(symbol: string, interval = '1min', outputsize = 60): Promise<Candle[]> {
  const key = `${symbol}:${interval}:${outputsize}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY não configurada');

  const url = new URL(`${BASE}/time_series`);
  url.searchParams.set('symbol', normalizeSymbol(symbol));
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', String(outputsize));
  url.searchParams.set('apikey', apiKey);

  const r = await fetch(url.toString());
  const json = await r.json();
  if (json.status === 'error' || json.code) throw new Error(`TwelveData: ${json.message || json.code}`);
  if (!Array.isArray(json.values)) throw new Error('TwelveData resposta inesperada');

  const candles: Candle[] = json.values
    .map((v: any) => ({
      open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close),
    }))
    .reverse();
  cache.set(key, { at: Date.now(), data: candles });
  return candles;
}

export async function getRealtimePrice(symbol: string): Promise<number> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY não configurada');
  const url = new URL(`${BASE}/price`);
  url.searchParams.set('symbol', normalizeSymbol(symbol));
  url.searchParams.set('apikey', apiKey);
  const r = await fetch(url.toString());
  const json = await r.json();
  if (json.status === 'error' || !json.price) throw new Error(`TwelveData price: ${json.message || 'sem preço'}`);
  return Number(json.price);
}
