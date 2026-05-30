// Gerador de copy "humano" — soa como pessoa real comentando depois de operar

const WIN_OPENERS = [
  'Bateu redondinho!', 'Saiu certinho aqui!', 'Peguei o reflexo fácil!',
  'Mais um green pro placar!', 'Disciplina pagando!',
  'Que delícia!', 'Coisa linda!', 'Pegou de primeira!',
  'Saiu sem dor!', 'Setup limpo demais!',
];

const WIN_MIDS = [
  '+{profit}$ pro bolso', 'mais {profit} dólares pra conta',
  'fechou em +{profit}$', 'pegou +{profit}$ liso', 'ganhei mais {profit}$ aqui',
];

const WIN_CLOSERS = [
  'Bora pro próximo! 🔥', 'Próximo já vai 🚀',
  'Disciplina galera, segue o jogo! 💰',
  'Quem tá comigo no VIP tá faturando hoje! 📈',
  'Pra cima! Bora bora 💪', 'Foco total. Próximo sinal já já! ⚡',
  'Estratégia funcionando demais! 💎',
  'Tô passando o sinal aqui, quem tá comigo? 🎯',
];

const LOSS_OPENERS = [
  'Foi pro gale.', 'Não bateu essa.', 'Perdeu por pouco.',
  'Refluxo aqui.', 'Sem chorar — perdeu uma.', 'Stop respeitado.',
  'Bateu de raspão pro outro lado.', 'Essa não foi.',
];

const LOSS_MIDS = [
  'mas o gerenciamento tá redondo',
  'mas tô seguindo o plano',
  'mas é assim mesmo, mercado vai e vem',
  'normal, parte do processo',
  'sem trauma, próximo a gente recupera',
];

const LOSS_CLOSERS = [
  'Bora pro gale e seguir! 💪',
  'Disciplina manda — próximo é nosso 🎯',
  'Mercado tá assim hoje, mas a estratégia tá no ponto ⚡',
  'Gerenciamento + paciência. Bora! 🔥',
  'Quem ficou no VIP sabe — recuperação na sequência 💚',
  'Sem chorar. Próxima já tá vindo 🚀',
];

export function buildHumanCopy(opts: {
  result: 'WIN' | 'LOSS';
  pair: string;
  investment: number;
  profit: number;
  direction: 'CALL' | 'PUT';
}): string {
  const { result, pair, investment, profit, direction } = opts;
  const isWin = result === 'WIN';
  const profitAbs = Math.abs(profit).toFixed(2).replace('.', ',');
  const profitInt = Math.round(Math.abs(profit));
  const arrow = direction === 'CALL' ? '🟢 CALL' : '🔴 PUT';

  if (isWin) {
    const opener = pick(WIN_OPENERS);
    const mid = pick(WIN_MIDS).replace('{profit}', String(profitInt));
    const closer = pick(WIN_CLOSERS);
    return [
      `${opener} ✅`,
      ``,
      `${arrow} ${pair} — entrada de ${investment}$ ➡️ ${mid}`,
      ``,
      `💰 LUCRO LÍQUIDO: +${profitAbs}$`,
      ``,
      closer,
    ].join('\n');
  } else {
    const opener = pick(LOSS_OPENERS);
    const mid = pick(LOSS_MIDS);
    const closer = pick(LOSS_CLOSERS);
    return [
      `${opener} ❌`,
      ``,
      `${arrow} ${pair} — entrada ${investment}$ — ${mid}`,
      ``,
      `📉 Resultado: -${profitAbs}$`,
      ``,
      closer,
    ].join('\n');
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
