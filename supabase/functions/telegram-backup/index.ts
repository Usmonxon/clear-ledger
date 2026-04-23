// Generates an Excel backup (raw + DDS + OPU) and sends to Telegram chat
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import ExcelJS from 'https://esm.sh/exceljs@4.4.0';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Txn = {
  transaction_date: string;
  reporting_month: string;
  type: string;
  cashflow_category: string;
  amount: number;
};

function buildReportSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  transactions: Txn[],
  monthField: 'transaction_date' | 'reporting_month',
  label: string,
  includeTransfers: boolean,
  cogsNames?: Set<string>,
) {
  const filtered = includeTransfers ? transactions : transactions.filter((t) => t.type !== 'transfer');
  const monthSet = new Set<string>();
  filtered.forEach((t) => {
    const val = monthField === 'transaction_date' ? t.transaction_date?.substring(0, 7) : t.reporting_month;
    if (val) monthSet.add(val);
  });
  const months = Array.from(monthSet).sort();
  if (!months.length) return;

  const names = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const monthLabel = (k: string) => {
    const [y, m] = k.split('-');
    return `${names[parseInt(m) - 1]} ${y}`;
  };

  const groups: Record<string, Record<string, Record<string, number>>> = { income: {}, expense: {} };
  if (includeTransfers) groups.transfer = {};
  if (cogsNames && cogsNames.size > 0) groups.cogs = {};

  filtered.forEach((t) => {
    const mk = monthField === 'transaction_date' ? t.transaction_date?.substring(0, 7) : t.reporting_month;
    if (!mk) return;
    let groupKey = t.type;
    if (cogsNames && t.type === 'expense' && cogsNames.has(t.cashflow_category)) groupKey = 'cogs';
    const g = groups[groupKey];
    if (!g) return;
    const cat = t.cashflow_category;
    if (!g[cat]) g[cat] = {};
    g[cat][mk] = (g[cat][mk] || 0) + Number(t.amount);
  });

  const ws = wb.addWorksheet(sheetName);
  ws.addRow(['Категория', 'ГОД', ...months.map(monthLabel)]);

  const addSection = (title: string, cats: Record<string, Record<string, number>>) => {
    const totalRow: (string | number)[] = [title];
    let yearTotal = 0;
    const monthSums = months.map((mk) => {
      let sum = 0;
      Object.values(cats).forEach((c) => { sum += c[mk] || 0; });
      yearTotal += sum;
      return sum;
    });
    totalRow.push(yearTotal, ...monthSums);
    ws.addRow(totalRow);
    Object.entries(cats).forEach(([cat, vals]) => {
      const row: (string | number)[] = [`  ${cat}`];
      let yt = 0;
      months.forEach((mk) => { yt += vals[mk] || 0; });
      row.push(yt);
      months.forEach((mk) => row.push(vals[mk] || 0));
      ws.addRow(row);
    });
  };

  addSection('ДОХОДЫ', groups.income);

  const hasCogs = groups.cogs && Object.keys(groups.cogs).length > 0;
  if (hasCogs) {
    addSection('СЕБЕСТОИМОСТЬ', groups.cogs);
    const gpRow: (string | number)[] = ['ВАЛОВАЯ ПРИБЫЛЬ'];
    let gpYear = 0;
    const gpMonths = months.map((mk) => {
      let inc = 0, cogs = 0;
      Object.values(groups.income).forEach((c) => { inc += c[mk] || 0; });
      Object.values(groups.cogs).forEach((c) => { cogs += c[mk] || 0; });
      gpYear += inc - cogs;
      return inc - cogs;
    });
    gpRow.push(gpYear, ...gpMonths);
    ws.addRow(gpRow);
  }

  addSection(hasCogs ? 'ОПЕРАЦИОННЫЕ РАСХОДЫ' : 'РАСХОДЫ', groups.expense);

  const profitRow: (string | number)[] = [label === 'ДДС' ? 'ПРИБЫЛЬ (по кассе)' : 'ЧИСТАЯ ПРИБЫЛЬ'];
  let profitYear = 0;
  const profitMonths = months.map((mk) => {
    let inc = 0, exp = 0;
    Object.values(groups.income).forEach((c) => { inc += c[mk] || 0; });
    Object.values(groups.expense).forEach((c) => { exp += c[mk] || 0; });
    if (groups.cogs) Object.values(groups.cogs).forEach((c) => { exp += c[mk] || 0; });
    profitYear += inc - exp;
    return inc - exp;
  });
  profitRow.push(profitYear, ...profitMonths);
  ws.addRow(profitRow);

  if (includeTransfers && groups.transfer && Object.keys(groups.transfer).length) {
    addSection('ПЕРЕВОДЫ', groups.transfer);
  }
}

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

  // Build DDS and OPU report sheets
  if (txns && txns.length) {
    const cogsNames = new Set<string>();
    (cats || []).forEach((c: any) => {
      if (c.type === 'expense' && c.is_cogs) cogsNames.add(c.name);
    });
    buildReportSheet(wb, 'ДДС', txns as Txn[], 'transaction_date', 'ДДС', true);
    buildReportSheet(wb, 'ОПУ', txns as Txn[], 'reporting_month', 'ОПУ', false, cogsNames);
  }

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
