// Print estilo da plataforma Quotex (chart + side panel) — pareçe screenshot real
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const W = 1100, H = 700;

// Embute fonte Inter no SVG (Vercel não tem Arial)
let FONT_REGULAR_B64 = '';
let FONT_BOLD_B64 = '';
try {
  FONT_REGULAR_B64 = readFileSync(join(process.cwd(), 'lib/fonts/Inter-Regular.ttf')).toString('base64');
  FONT_BOLD_B64 = readFileSync(join(process.cwd(), 'lib/fonts/Inter-Bold.ttf')).toString('base64');
} catch (e) {
  console.warn('[platformPrint] fontes não carregaram:', e);
}

const FONT_STYLE = `
<style>
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  src: url('data:font/ttf;base64,${FONT_REGULAR_B64}') format('truetype');
}
@font-face {
  font-family: 'Inter';
  font-weight: 700;
  src: url('data:font/ttf;base64,${FONT_BOLD_B64}') format('truetype');
}
text { font-family: 'Inter', sans-serif; }
</style>
`;

export type PlatformPrintOpts = {
  pair: string;            // ex "CAD/JPY (OTC)"
  payout: number;          // 85
  investment: number;      // 20
  result: 'WIN' | 'LOSS';
  profit: number;          // positivo se win, negativo se loss
  direction: 'CALL' | 'PUT';
  openPrice?: number;
  closePrice?: number;
  expirationMinutes?: number; // 1 = M1
};

export async function renderPlatformPng(o: PlatformPrintOpts): Promise<Buffer> {
  const svg = buildSvg(o);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}

function buildSvg(o: PlatformPrintOpts) {
  const isWin = o.result === 'WIN';
  const isCall = o.direction === 'CALL';
  const profitAbs = Math.abs(o.profit).toFixed(2);
  const profitSign = isWin ? '+' : '-';
  const accent = isWin ? '#00d09c' : '#ff4d6d';
  const dirArrow = isCall ? '▲' : '▼';
  const dirColor = isCall ? '#00d09c' : '#ff4d6d';

  // valores de preço — usar reais se vierem, senão simular
  const open = o.openPrice ?? randPrice(o.pair);
  const close = o.closePrice ?? (open + (isWin === isCall ? 0.0008 : -0.0008));
  const decimals = o.pair.toUpperCase().includes('JPY') ? 3 : 5;
  const openStr = open.toFixed(decimals);
  const closeStr = close.toFixed(decimals);

  // chart
  const chart = buildChart(isWin, isCall);

  // status
  const statusBox = isWin
    ? `<g><rect x="0" y="0" width="280" height="32" rx="4" fill="#00d09c"/>
        <text x="140" y="21" font-family="Arial" font-size="13" font-weight="700" fill="#0a1224" text-anchor="middle">VITÓRIA · OPERAÇÃO FECHADA</text></g>`
    : `<g><rect x="0" y="0" width="280" height="32" rx="4" fill="#ff4d6d"/>
        <text x="140" y="21" font-family="Arial" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">DERROTA · OPERAÇÃO FECHADA</text></g>`;

  // entry marker no chart
  const entryX = 95, entryY = 320;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${FONT_STYLE}
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1325"/><stop offset="100%" stop-color="#070a17"/>
    </linearGradient>
    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- BG escuro -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- ÁREA DO CHART (esquerda) -->
  <g transform="translate(0, 0)">
    <!-- Labels Abertura/Fechamento -->
    <text x="35" y="50" font-family="Arial" font-size="13" fill="#5d6987">‹ Abertura da negociação</text>
    <text x="490" y="50" font-family="Arial" font-size="13" fill="#5d6987" text-anchor="end">Fechamento da negociação ›</text>

    <!-- Linhas verticais (separadores no chart) -->
    <line x1="95" y1="60" x2="95" y2="640" stroke="#1c2440" stroke-width="1" stroke-dasharray="2,3"/>
    <line x1="500" y1="60" x2="500" y2="640" stroke="#1c2440" stroke-width="1" stroke-dasharray="2,3"/>

    <!-- Candles fake -->
    ${chart.candles}

    <!-- Linha horizontal de preço de entrada -->
    <line x1="0" y1="${entryY}" x2="700" y2="${entryY}" stroke="#5d6987" stroke-width="1" stroke-dasharray="3,3"/>

    <!-- Badge do investimento na entrada -->
    <g transform="translate(${entryX - 50}, ${entryY - 14})">
      <rect width="100" height="28" rx="4" fill="${accent}"/>
      <circle cx="14" cy="14" r="9" fill="#ffffff" opacity="0.18"/>
      <text x="14" y="18" font-family="Arial" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">↑</text>
      <text x="36" y="18" font-family="Arial" font-size="13" font-weight="700" fill="#ffffff">$${o.investment}</text>
      <text x="84" y="19" font-family="Arial" font-size="11" fill="#ffffff" text-anchor="end" opacity="0.85">${expirCountdown(o.expirationMinutes)}</text>
    </g>

    <!-- Preço do close (direita) -->
    <g transform="translate(680, ${entryY - 12})">
      <rect width="78" height="24" rx="4" fill="${isWin ? '#00d09c' : '#ff4d6d'}"/>
      <text x="39" y="16" font-family="Arial" font-size="12" font-weight="700" fill="${isWin ? '#0a1224' : '#ffffff'}" text-anchor="middle">${closeStr}</text>
    </g>

    <!-- Eixo Y de precos (direita) -->
    <g font-family="Arial" font-size="11" fill="#5d6987" text-anchor="end">
      ${priceAxis(open, decimals)}
    </g>
  </g>

  <!-- DIVISOR -->
  <line x1="760" y1="0" x2="760" y2="${H}" stroke="#1c2440" stroke-width="1"/>

  <!-- PAINEL DIREITO -->
  <g transform="translate(776, 24)">
    <!-- Header par + payout -->
    <g>
      <circle cx="14" cy="14" r="14" fill="#1c2440"/>
      <text x="14" y="19" font-family="Arial" font-size="13" font-weight="700" fill="#${isCall ? '00d09c' : 'ff4d6d'}" text-anchor="middle">${dirArrow}</text>
      <text x="38" y="13" font-family="Arial" font-size="13" font-weight="700" fill="#ffffff">${escXml(o.pair)}</text>
      <text x="38" y="29" font-family="Arial" font-size="11" fill="#5d6987">Payout</text>
      <text x="220" y="20" font-family="Arial" font-size="16" font-weight="700" fill="#ffffff" text-anchor="end">${o.payout}%</text>
    </g>

    <!-- Status -->
    <g transform="translate(0, 50)">${statusBox}</g>

    <!-- Tempo box -->
    <g transform="translate(0, 96)">
      <rect width="280" height="64" rx="6" fill="#101a30" stroke="#1c2440"/>
      <text x="140" y="20" font-family="Arial" font-size="10" fill="#5d6987" text-anchor="middle">TEMPO</text>
      <text x="140" y="44" font-family="Arial" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">${expirText(o.expirationMinutes)}</text>
      <text x="140" y="58" font-family="Arial" font-size="9" fill="#3d80ff" text-anchor="middle">TEMPO DE COMUTAÇÃO</text>
    </g>

    <!-- Investimento box -->
    <g transform="translate(0, 172)">
      <rect width="280" height="64" rx="6" fill="#101a30" stroke="#1c2440"/>
      <text x="140" y="20" font-family="Arial" font-size="10" fill="#5d6987" text-anchor="middle">INVESTIMENTO</text>
      <text x="140" y="44" font-family="Arial" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">${o.investment} $</text>
      <text x="140" y="58" font-family="Arial" font-size="9" fill="#3d80ff" text-anchor="middle">TROCAR</text>
    </g>

    <!-- Pagamento -->
    <g transform="translate(0, 248)">
      <text x="0" y="14" font-family="Arial" font-size="13" fill="#5d6987">Pagamento</text>
      <text x="280" y="14" font-family="Arial" font-size="14" font-weight="700" fill="${isWin ? '#00d09c' : '#ffffff'}" text-anchor="end">${profitSign}${profitAbs} $</text>
    </g>

    <!-- Botoes Para cima / Para baixo -->
    <g transform="translate(0, 272)">
      <rect width="280" height="46" rx="6" fill="${isCall ? '#00d09c' : '#1c2440'}"/>
      <text x="140" y="29" font-family="Arial" font-size="15" font-weight="700" fill="${isCall ? '#0a1224' : '#3d4869'}" text-anchor="middle">▲ Para cima</text>
    </g>
    <g transform="translate(0, 326)">
      <rect width="280" height="46" rx="6" fill="${!isCall ? '#ff4d6d' : '#1c2440'}"/>
      <text x="140" y="29" font-family="Arial" font-size="15" font-weight="700" fill="${!isCall ? '#ffffff' : '#3d4869'}" text-anchor="middle">▼ Para baixo</text>
    </g>

    <!-- Tab "Operações" -->
    <g transform="translate(0, 392)">
      <line x1="0" y1="0" x2="280" y2="0" stroke="#1c2440"/>
      <rect x="0" y="0" width="180" height="36" fill="transparent"/>
      <text x="40" y="22" font-family="Arial" font-size="13" font-weight="700" fill="#3d80ff">Operações</text>
      <circle cx="105" cy="18" r="9" fill="#3d80ff"/>
      <text x="105" y="22" font-family="Arial" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">1</text>
      <line x1="0" y1="36" x2="180" y2="36" stroke="#3d80ff" stroke-width="2"/>
    </g>

    <!-- Card da operação -->
    <g transform="translate(0, 440)">
      <text x="140" y="14" font-family="Arial" font-size="10" fill="#5d6987" text-anchor="middle">30 MAIO</text>
      <g transform="translate(0, 26)">
        <rect width="280" height="62" rx="6" fill="#101a30"/>
        <circle cx="20" cy="20" r="11" fill="#1c2440"/>
        <text x="20" y="25" font-family="Arial" font-size="12" font-weight="700" fill="${dirColor}" text-anchor="middle">${dirArrow}</text>
        <text x="42" y="18" font-family="Arial" font-size="13" font-weight="700" fill="#ffffff">${escXml(shortPair(o.pair))}</text>
        <text x="270" y="18" font-family="Arial" font-size="11" fill="#5d6987" text-anchor="end">${expirText(o.expirationMinutes)}</text>
        <text x="42" y="38" font-family="Arial" font-size="11" fill="#ffffff">▲ ${o.investment} $</text>
        <text x="270" y="38" font-family="Arial" font-size="13" font-weight="700" fill="${accent}" text-anchor="end">${profitSign}${profitAbs} $</text>

        <!-- "Vender agora" -->
        <rect x="14" y="46" width="100" height="22" rx="3" fill="#3d80ff" fill-opacity="0.0"/>
      </g>
    </g>
  </g>

  <!-- Eixo X de tempo (bottom) -->
  <g font-family="Arial" font-size="10" fill="#3d4869" text-anchor="middle">
    ${timeAxis()}
  </g>
</svg>`;
}

// ============================================================
// HELPERS
// ============================================================
function escXml(s: any) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' } as any)[c]);
}

function shortPair(p: string) {
  // CAD/JPY (OTC) -> CAD/JPY (O...
  return p.length > 12 ? p.slice(0, 10) + '...' : p;
}

function expirText(m?: number) {
  const min = (m || 1);
  return `00:0${min}:00`;
}
function expirCountdown(m?: number) {
  return '00:54';  // visual estatico (parece estar em andamento)
}

function randPrice(pair: string) {
  const u = pair.toUpperCase();
  if (u.includes('JPY')) return 116 + Math.random() * 6;
  if (u.includes('BTC')) return 60000 + Math.random() * 20000;
  if (u.includes('GBP')) return 1.25 + Math.random() * 0.10;
  if (u.includes('AUD')) return 0.65 + Math.random() * 0.08;
  return 1.05 + Math.random() * 0.15;
}

function priceAxis(basePrice: number, decimals: number) {
  const step = decimals === 3 ? 0.020 : 0.00020;
  const out: string[] = [];
  for (let i = -4; i <= 4; i++) {
    const v = (basePrice + i * step).toFixed(decimals);
    const y = 320 + i * 56;
    out.push(`<text x="745" y="${y + 4}">${v}</text>`);
  }
  return out.join('');
}

function timeAxis() {
  const out: string[] = [];
  const times = ['00:54:00', '00:55:00', '00:56:00', '00:57:00', '00:58:00', '00:59:00', '01:00:00'];
  times.forEach((t, i) => {
    out.push(`<text x="${60 + i * 110}" y="${H - 8}">${t}</text>`);
  });
  return out.join('');
}

function buildChart(isWin: boolean, isCall: boolean) {
  // 35 candles, finais coloridos pela direção do trade
  const goingUp = (isWin && isCall) || (!isWin && !isCall);
  const candles: string[] = [];
  const startX = 30, endX = 700;
  const yMid = 380;
  const width = (endX - startX) / 35;
  let prev = yMid;
  for (let i = 0; i < 35; i++) {
    const bias = (i / 35) * (goingUp ? -1.8 : 1.8);
    const change = (Math.random() - 0.5) * 14 + bias;
    const open = prev;
    const close = prev + change;
    const high = Math.min(open, close) - Math.random() * 10;
    const low = Math.max(open, close) + Math.random() * 10;
    const isGreen = close < open;  // close menor = preço subiu (svg invertido)
    const color = isGreen ? '#00d09c' : '#ff4d6d';
    const cw = Math.max(4, width - 3);
    const cx = startX + i * width + width / 2;
    const top = Math.min(open, close);
    const bot = Math.max(open, close);
    candles.push(`<line x1="${cx}" y1="${high}" x2="${cx}" y2="${low}" stroke="${color}" stroke-width="1"/>`);
    candles.push(`<rect x="${cx - cw / 2}" y="${top}" width="${cw}" height="${Math.max(2, bot - top)}" fill="${color}"/>`);
    prev = close;
  }
  return { candles: candles.join('') };
}
