// Gera print de resultado estilo Quotex (SVG -> PNG via sharp).
import sharp from 'sharp';

const W = 880, H = 760;

export type PrintOpts = {
  pair: string; direction: 'CALL' | 'PUT';
  amount: number; payout: number; profit: number;
  result: 'WIN' | 'LOSS';
  timeframe?: string;
  openTime?: Date; closingTime?: Date;
};

export async function renderResultPng(o: PrintOpts): Promise<Buffer> {
  const svg = buildSvg(o);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}

function buildSvg(o: PrintOpts) {
  const isWin = o.result === 'WIN', isCall = o.direction === 'CALL';
  const profitAbs = Math.abs(Number(o.profit) || 0).toFixed(2);
  const profitSign = isWin ? '+' : '-';
  const profitColor = isWin ? '#00c896' : '#ff4d4d';
  const directionColor = isCall ? '#00c896' : '#ff4d4d';
  const directionArrow = isCall ? '▲' : '▼';
  const payoutAmount = (Number(o.amount) * (1 + Number(o.payout) / 100)).toFixed(2);
  const open = o.openTime || new Date(Date.now() - 60_000);
  const close = o.closingTime || new Date();
  const remainingSec = Math.max(0, Math.floor((close.getTime() - open.getTime()) / 1000));
  const chart = buildChart(isWin, isCall);
  const tf = o.timeframe || 'M1';
  const fmtT = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const cd = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c2541"/><stop offset="100%" stop-color="#0b132b"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#243056"/><stop offset="100%" stop-color="#1a2244"/>
    </linearGradient>
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${profitColor}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${profitColor}" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g transform="translate(40, 30)">
    <text x="0" y="22" font-family="Arial" font-size="22" font-weight="700" fill="#2b7fff" letter-spacing="2">BINARY OPTIONS VIP</text>
    ${checks(265, 14, 6)}
  </g>
  <g transform="translate(40, 80)">
    <rect width="${W - 80}" height="540" rx="14" fill="url(#bg)"/>
    <g transform="translate(28, 32)">
      <text x="0" y="14" font-family="Arial" font-size="16" fill="#ffd700">★</text>
      <text x="22" y="16" font-family="Arial" font-size="17" font-weight="600" fill="#ffffff">${esc(o.pair)}</text>
      <text x="${22 + (o.pair.length * 10) + 8}" y="16" font-family="Arial" font-size="14" fill="#7fc8a4">+${o.payout}%</text>
      <text x="${W - 80 - 60}" y="16" font-family="Arial" font-size="15" fill="#ffffff" text-anchor="end">${cd(remainingSec)}</text>
    </g>
    <g transform="translate(28, 70)">
      <text x="0" y="0" font-family="Arial" font-size="20" fill="${directionColor}">${directionArrow}</text>
      <text x="22" y="0" font-family="Arial" font-size="22" font-weight="600" fill="#ffffff">$${fnum(o.amount)}</text>
      <text x="${W / 2 - 40}" y="0" font-family="Arial" font-size="22" font-weight="600" fill="#ffffff">$${payoutAmount}</text>
      <text x="${W - 80 - 28}" y="0" font-family="Arial" font-size="22" font-weight="700" fill="${profitColor}" text-anchor="end">${profitSign}$${profitAbs}</text>
    </g>
    <g transform="translate(28, 95)">
      <rect width="${W - 80 - 56}" height="38" rx="6" fill="#2c3961"/>
      <text x="${(W - 80 - 56) / 2}" y="24" font-family="Arial" font-size="15" font-weight="600" fill="#aab4d4" text-anchor="middle">⇈  Double Up</text>
    </g>
    <g transform="translate(28, 160)" font-family="Arial" font-size="13" fill="#8a96b8">
      <text x="0" y="0">Open time:</text>
      <text x="${(W - 80 - 56) / 2}" y="0" text-anchor="middle">${tf}</text>
      <text x="${W - 80 - 28}" y="0" text-anchor="end">Closing time:</text>
    </g>
    <g transform="translate(28, 182)" font-family="Arial" font-size="15" fill="#ffffff" font-weight="600">
      <text x="0" y="0">${fmtT(open)}</text>
      <text x="${W - 80 - 28}" y="0" text-anchor="end">${fmtT(close)}</text>
    </g>
    <g transform="translate(28, 200)">
      <rect width="${W - 80 - 56}" height="3" rx="1.5" fill="#2c3961"/>
      <rect width="${(W - 80 - 56) * 0.45}" height="3" rx="1.5" fill="#2b7fff"/>
    </g>
    <g transform="translate(28, 222)" font-family="Arial" font-size="12" fill="#8a96b8">
      <text x="${(W - 80 - 56) / 2}" y="0" text-anchor="middle">Time left:  ${cd(Math.max(0, remainingSec - 1))}</text>
    </g>
    <g transform="translate(28, 245)">
      <rect width="${W - 80 - 56}" height="140" rx="8" fill="url(#card)"/>
      <g transform="translate(20, 28)" font-family="Arial" font-size="13">
        <text x="0" y="0" fill="#8a96b8">Your forecast:</text>
        <text x="0" y="22" font-size="17" font-weight="700" fill="${directionColor}">${o.direction}</text>
        <text x="${(W - 80 - 56 - 40) / 2}" y="0" fill="#8a96b8" text-anchor="middle">Payout:</text>
        <text x="${(W - 80 - 56 - 40) / 2}" y="22" font-size="17" font-weight="700" fill="${profitColor}" text-anchor="middle">$${fnum(o.amount)}</text>
        <text x="${W - 80 - 56 - 40}" y="0" fill="#8a96b8" text-anchor="end">Profit:</text>
        <text x="${W - 80 - 56 - 40}" y="22" font-size="17" font-weight="700" fill="${profitColor}" text-anchor="end">${profitSign}$${profitAbs}</text>
      </g>
      <g transform="translate(20, 90)" font-family="Arial" font-size="13">
        <text x="0" y="0" fill="#8a96b8">Open price:</text>
        <text x="0" y="20" font-size="14" font-weight="600" fill="#ffffff">${randPrice(o.pair, 0)}</text>
        <text x="${(W - 80 - 56 - 40) / 2}" y="0" fill="#8a96b8" text-anchor="middle">Difference:</text>
        <text x="${(W - 80 - 56 - 40) / 2}" y="20" font-size="14" font-weight="600" fill="${profitColor}" text-anchor="middle">(${profitSign}${Math.floor(Math.random() * 40 + 10)} Points)</text>
        <text x="${W - 80 - 56 - 40}" y="0" fill="#8a96b8" text-anchor="end">Current price:</text>
        <text x="${W - 80 - 56 - 40}" y="20" font-size="14" font-weight="600" fill="#ffffff" text-anchor="end">${randPrice(o.pair, isWin ? (isCall ? 1 : -1) : (isCall ? -1 : 1))}</text>
      </g>
    </g>
    <g transform="translate(28, 405)">
      <rect width="${W - 80 - 56}" height="110" rx="6" fill="#10182f"/>
      <path d="${chart.area}" fill="url(#fill)"/>
      <path d="${chart.line}" fill="none" stroke="${profitColor}" stroke-width="2.2" filter="url(#glow)"/>
      <line x1="${chart.entryX}" y1="6" x2="${chart.entryX}" y2="104" stroke="#aab4d4" stroke-width="1" stroke-dasharray="3,3"/>
      <rect x="${chart.entryX - 30}" y="${chart.entryY - 12}" width="60" height="22" rx="3" fill="${directionColor}"/>
      <text x="${chart.entryX}" y="${chart.entryY + 4}" font-family="Arial" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">$${fnum(o.amount)}</text>
    </g>
  </g>
  <g transform="translate(40, 660)">
    <text x="0" y="24" font-family="Arial" font-size="26" font-weight="800" fill="${profitColor}">
      ${isWin ? 'Profit + 🔥' : 'Loss — próximo gale 💪'}
    </text>
    <text x="0" y="58" font-family="Arial" font-size="22" font-weight="700" fill="#101828">
      ${isWin ? `In the bank ${Math.round(Number(profitAbs))}$ 💰` : 'Stop loss respeitado ⚡'}
    </text>
  </g>
</svg>`;
}

function esc(s: any) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' } as any)[c]);
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function fnum(n: number) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }

function randPrice(pair: string, delta: number) {
  const u = pair.toUpperCase();
  let base = 1.0;
  if (u.includes('JPY')) base = 110 + Math.random() * 40;
  else if (u.includes('BTC')) base = 60000 + Math.random() * 20000;
  else if (u.includes('GBP')) base = 1.20 + Math.random() * 0.15;
  else if (u.includes('AUD')) base = 0.65 + Math.random() * 0.10;
  else base = 1.05 + Math.random() * 0.20;
  const variation = (Math.random() * 0.0008 + 0.0002) * delta;
  const decimals = u.includes('JPY') ? 3 : u.includes('BTC') ? 1 : 5;
  return (base * (1 + variation)).toFixed(decimals);
}

function buildChart(isWin: boolean, isCall: boolean) {
  const w = W - 80 - 56, h = 110, padX = 10, padY = 12, steps = 40;
  const innerW = w - padX * 2;
  const goingUp = (isWin && isCall) || (!isWin && !isCall);
  const pts: [number, number][] = [];
  let y = h / 2;
  for (let i = 0; i <= steps; i++) {
    const bias = (i / steps) * (goingUp ? -1 : 1) * 1.4;
    y += (Math.random() - 0.5) * 6 + bias;
    y = Math.max(padY, Math.min(h - padY, y));
    pts.push([padX + (i / steps) * innerW, y]);
  }
  const entryIdx = Math.floor(steps * 0.32);
  const [entryX, entryY] = pts[entryIdx];
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${padX + innerW} ${h} L ${padX} ${h} Z`;
  return { line: lineD, area: areaD, entryX, entryY };
}

function checks(startX: number, y: number, count: number) {
  const colors = ['#2b7fff', '#00c896', '#ffd700', '#ff4d4d', '#7fc8a4', '#2b7fff'];
  return Array.from({ length: count }, (_, i) =>
    `<text x="${startX + i * 18}" y="${y + 8}" font-family="Arial" font-size="14" fill="${colors[i % colors.length]}">✓</text>`).join('');
}
