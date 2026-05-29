// Cliente minimalista pra Bot API do Telegram (sem dep).

const API = 'https://api.telegram.org/bot';

export async function sendMessage(token: string, chat_id: number | string, text: string, opts: any = {}) {
  const r = await fetch(`${API}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown', disable_web_page_preview: true, ...opts }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram sendMessage: ${j.description}`);
  return j.result;
}

export async function sendPhoto(token: string, chat_id: number | string, photoBuffer: Buffer, caption: string, opts: any = {}) {
  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('caption', caption);
  if (opts.parse_mode !== null) form.append('parse_mode', opts.parse_mode || 'Markdown');
  if (opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
  const blob = new Blob([photoBuffer], { type: 'image/png' });
  form.append('photo', blob, 'signal.png');
  const r = await fetch(`${API}${token}/sendPhoto`, { method: 'POST', body: form });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram sendPhoto: ${j.description}`);
  return j.result;
}

export async function getChat(token: string, chat_id: string | number) {
  const r = await fetch(`${API}${token}/getChat?chat_id=${encodeURIComponent(String(chat_id))}`);
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram getChat: ${j.description}`);
  return j.result;
}
