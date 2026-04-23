// Sends a daily digest of yesterday's activity to all users with daily_digest=true
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');

const sendMessage = (chat_id: number, text: string) =>
  fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
  });

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: links } = await supabase
    .from('telegram_links')
    .select('user_id, chat_id')
    .eq('daily_digest', true)
    .not('chat_id', 'is', null);

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  let sent = 0;

  for (const link of links || []) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('type, amount, currency, cashflow_category')
      .eq('user_id', link.user_id)
      .eq('transaction_date', yesterday);

    if (!txns || txns.length === 0) continue;

    const totals: Record<string, { income: number; expense: number }> = {};
    txns.forEach((t: any) => {
      if (!totals[t.currency]) totals[t.currency] = { income: 0, expense: 0 };
      const amt = Number(t.amount);
      if (t.type === 'income') totals[t.currency].income += amt;
      else if (t.type === 'expense') totals[t.currency].expense += amt;
    });

    const lines = Object.entries(totals).map(
      ([c, v]) => `<b>${c}</b>: +${fmt(v.income)} / −${fmt(v.expense)} = ${fmt(v.income - v.expense)}`
    );
    const text = `☀️ <b>Дайджест за ${yesterday}</b>\nОпераций: ${txns.length}\n\n${lines.join('\n')}`;
    await sendMessage(link.chat_id, text);
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { 'Content-Type': 'application/json' } });
});
