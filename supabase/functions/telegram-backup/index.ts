// Generates an Excel backup and sends to Telegram chat
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ExcelJS from 'https://esm.sh/exceljs@4.4.0';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => ({}));
  const { user_id, chat_id } = body;
  if (!user_id || !chat_id) return new Response('Missing user_id or chat_id', { status: 400 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: txns }, { data: accounts }, { data: cats }, { data: rates }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user_id).order('transaction_date', { ascending: false }),
    supabase.from('accounts').select('name, currency, initial_balance, created_at').eq('user_id', user_id).order('name'),
    supabase.from('categories').select('name, type, is_cogs, created_at').eq('user_id', user_id).order('type'),
    supabase.from('exchange_rates').select('effective_date, from_currency, to_currency, rate').eq('user_id', user_id).order('effective_date', { ascending: false }),
  ]);

  const wb = new ExcelJS.Workbook();
  const addSheet = (name: string, rows: any[] | null) => {
    if (!rows || !rows.length) return;
    const ws = wb.addWorksheet(name);
    const cols = Object.keys(rows[0]);
    ws.addRow(cols);
    rows.forEach((r) => ws.addRow(cols.map((c) => r[c])));
  };
  addSheet('Операции', txns);
  addSheet('Счета', accounts);
  addSheet('Категории', cats);
  addSheet('Курсы валют', rates);

  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `finco-backup-${dateStr}.xlsx`;

  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('caption', `📦 Резервная копия Finco · ${dateStr}`);
  form.append('document', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);

  const resp = await fetch(`${GATEWAY_URL}/sendDocument`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
    },
    body: form,
  });
  const respText = await resp.text();
  if (!resp.ok) return new Response(respText, { status: 502 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
