// Called from the client right after creating a transaction.
// Sends a Telegram notification if user has notify_on_new_tx enabled.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Verify user from JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const { type, amount, currency, cashflow_category, wallet_account, description } = body;
  if (!type || amount == null || !currency) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: link } = await admin
    .from('telegram_links')
    .select('chat_id, notify_on_new_tx')
    .eq('user_id', userId)
    .maybeSingle();

  if (!link?.chat_id || !link.notify_on_new_tx) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const emoji = type === 'income' ? '💚' : type === 'expense' ? '❤️' : type === 'transfer' ? '🔄' : '💜';
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '';
  const text = `${emoji} <b>${sign}${fmt(Number(amount))} ${currency}</b>\n${cashflow_category || ''}${wallet_account ? ` · ${wallet_account}` : ''}${description ? `\n<i>${description}</i>` : ''}`;

  const resp = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: link.chat_id, text, parse_mode: 'HTML' }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    return new Response(JSON.stringify({ error: t }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
