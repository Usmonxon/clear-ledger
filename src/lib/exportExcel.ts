import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

type Transaction = {
  transaction_date: string;
  reporting_month: string;
  type: string;
  cashflow_category: string;
  pnl_category: string;
  amount: number;
  currency: string;
};

function buildReportSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  transactions: Transaction[],
  monthField: "transaction_date" | "reporting_month",
  label: string,
  includeTransfers: boolean
) {
  const filtered = includeTransfers
    ? transactions
    : transactions.filter((t) => t.type !== "transfer");

  const monthSet = new Set<string>();
  filtered.forEach((t) => {
    const val = monthField === "transaction_date" ? t.transaction_date?.substring(0, 7) : t.reporting_month;
    if (val) monthSet.add(val);
  });
  const months = Array.from(monthSet).sort();
  if (!months.length) return;

  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  const monthLabel = (k: string) => {
    const [y, m] = k.split("-");
    return `${names[parseInt(m) - 1]} ${y}`;
  };

  // Group by type+category → month → sum
  const groups: Record<string, Record<string, Record<string, number>>> = { income: {}, expense: {} };
  if (includeTransfers) groups.transfer = {};

  filtered.forEach((t) => {
    const mk = monthField === "transaction_date" ? t.transaction_date?.substring(0, 7) : t.reporting_month;
    if (!mk) return;
    const g = groups[t.type];
    if (!g) return;
    const cat = t.cashflow_category;
    if (!g[cat]) g[cat] = {};
    g[cat][mk] = (g[cat][mk] || 0) + t.amount;
  });

  const ws = wb.addWorksheet(sheetName);
  const header = ["Категория", "ГОД", ...months.map(monthLabel)];
  ws.addRow(header);

  const addSection = (title: string, cats: Record<string, Record<string, number>>) => {
    const totalRow: (string | number)[] = [title];
    let yearTotal = 0;
    months.forEach((mk) => {
      let sum = 0;
      Object.values(cats).forEach((c) => { sum += c[mk] || 0; });
      yearTotal += sum;
    });
    totalRow.push(yearTotal);
    months.forEach((mk) => {
      let sum = 0;
      Object.values(cats).forEach((c) => { sum += c[mk] || 0; });
      totalRow.push(sum);
    });
    ws.addRow(totalRow);

    Object.entries(cats).forEach(([cat, vals]) => {
      const row: (string | number)[] = [`  ${cat}`];
      let yt = 0;
      months.forEach((mk) => { yt += vals[mk] || 0; });
      row.push(yt);
      months.forEach((mk) => { row.push(vals[mk] || 0); });
      ws.addRow(row);
    });
  };

  addSection("ДОХОДЫ", groups.income);
  addSection("РАСХОДЫ", groups.expense);

  // Profit row
  const profitRow: (string | number)[] = [label === "ДДС" ? "ПРИБЫЛЬ (по кассе)" : "ЧИСТАЯ ПРИБЫЛЬ"];
  let profitYear = 0;
  months.forEach((mk) => {
    let inc = 0, exp = 0;
    Object.values(groups.income).forEach((c) => { inc += c[mk] || 0; });
    Object.values(groups.expense).forEach((c) => { exp += c[mk] || 0; });
    profitYear += inc - exp;
  });
  profitRow.push(profitYear);
  months.forEach((mk) => {
    let inc = 0, exp = 0;
    Object.values(groups.income).forEach((c) => { inc += c[mk] || 0; });
    Object.values(groups.expense).forEach((c) => { exp += c[mk] || 0; });
    profitRow.push(inc - exp);
  });
  ws.addRow(profitRow);

  if (includeTransfers && Object.keys(groups.transfer).length) {
    addSection("ПЕРЕВОДЫ", groups.transfer);
  }
}

export async function exportToExcel() {
  const wb = new ExcelJS.Workbook();

  // Transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("transaction_date, reporting_month, type, cashflow_category, pnl_category, wallet_account, from_account, to_account, amount, currency, target_amount, target_currency, description")
    .order("transaction_date", { ascending: false });

  if (transactions?.length) {
    const ws = wb.addWorksheet("Операции");
    const cols = Object.keys(transactions[0]);
    ws.addRow(cols);
    transactions.forEach((t) => ws.addRow(cols.map((c) => (t as any)[c])));

    buildReportSheet(wb, "ДДС", transactions as Transaction[], "transaction_date", "ДДС", true);
    buildReportSheet(wb, "ОПУ", transactions as Transaction[], "reporting_month", "ОПУ", false);
  }

  // Accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, currency, initial_balance, created_at")
    .order("name");

  if (accounts?.length) {
    const ws = wb.addWorksheet("Счета");
    const cols = Object.keys(accounts[0]);
    ws.addRow(cols);
    accounts.forEach((a) => ws.addRow(cols.map((c) => (a as any)[c])));
  }

  // Categories
  const { data: categories } = await supabase
    .from("categories")
    .select("name, type, created_at")
    .order("type, name");

  if (categories?.length) {
    const ws = wb.addWorksheet("Категории");
    const cols = Object.keys(categories[0]);
    ws.addRow(cols);
    categories.forEach((cat) => ws.addRow(cols.map((c) => (cat as any)[c])));
  }

  // Exchange rates
  const { data: rates } = await supabase
    .from("exchange_rates")
    .select("effective_date, from_currency, to_currency, rate")
    .order("effective_date", { ascending: false });

  if (rates?.length) {
    const ws = wb.addWorksheet("Курсы валют");
    const cols = Object.keys(rates[0]);
    ws.addRow(cols);
    rates.forEach((r) => ws.addRow(cols.map((c) => (r as any)[c])));
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finco-export-${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
