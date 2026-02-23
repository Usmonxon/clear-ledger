import * as XLSX from "xlsx";
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
  if (!months.length) return null;

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

  const rows: Record<string, string | number>[] = [];

  const addSection = (title: string, cats: Record<string, Record<string, number>>) => {
    // Total row
    const totalRow: Record<string, string | number> = { Категория: title };
    let yearTotal = 0;
    months.forEach((mk) => {
      let sum = 0;
      Object.values(cats).forEach((c) => { sum += c[mk] || 0; });
      totalRow[monthLabel(mk)] = sum;
      yearTotal += sum;
    });
    totalRow["ГОД"] = yearTotal;
    rows.push(totalRow);

    // Category rows
    Object.entries(cats).forEach(([cat, vals]) => {
      const row: Record<string, string | number> = { Категория: `  ${cat}` };
      let yt = 0;
      months.forEach((mk) => {
        row[monthLabel(mk)] = vals[mk] || 0;
        yt += vals[mk] || 0;
      });
      row["ГОД"] = yt;
      rows.push(row);
    });
  };

  addSection("ДОХОДЫ", groups.income);
  addSection("РАСХОДЫ", groups.expense);

  // Profit row
  const profitRow: Record<string, string | number> = { Категория: label === "ДДС" ? "ПРИБЫЛЬ (по кассе)" : "ЧИСТАЯ ПРИБЫЛЬ" };
  let profitYear = 0;
  months.forEach((mk) => {
    let inc = 0, exp = 0;
    Object.values(groups.income).forEach((c) => { inc += c[mk] || 0; });
    Object.values(groups.expense).forEach((c) => { exp += c[mk] || 0; });
    const p = inc - exp;
    profitRow[monthLabel(mk)] = p;
    profitYear += p;
  });
  profitRow["ГОД"] = profitYear;
  rows.push(profitRow);

  if (includeTransfers && Object.keys(groups.transfer).length) {
    addSection("ПЕРЕВОДЫ", groups.transfer);
  }

  // Reorder columns: Категория, ГОД, months...
  const header = ["Категория", "ГОД", ...months.map(monthLabel)];
  return XLSX.utils.json_to_sheet(rows, { header });
}

export async function exportToExcel() {
  const wb = XLSX.utils.book_new();

  // Transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("transaction_date, reporting_month, type, cashflow_category, pnl_category, wallet_account, from_account, to_account, amount, currency, target_amount, target_currency, description")
    .order("transaction_date", { ascending: false });

  if (transactions?.length) {
    const ws = XLSX.utils.json_to_sheet(transactions);
    XLSX.utils.book_append_sheet(wb, ws, "Операции");

    // Cashflow (ДДС) - by transaction_date, include transfers
    const cashflowSheet = buildReportSheet(transactions as Transaction[], "transaction_date", "ДДС", true);
    if (cashflowSheet) XLSX.utils.book_append_sheet(wb, cashflowSheet, "ДДС");

    // PnL (ОПУ) - by reporting_month, exclude transfers
    const pnlSheet = buildReportSheet(transactions as Transaction[], "reporting_month", "ОПУ", false);
    if (pnlSheet) XLSX.utils.book_append_sheet(wb, pnlSheet, "ОПУ");
  }

  // Accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, currency, initial_balance, created_at")
    .order("name");

  if (accounts?.length) {
    const ws = XLSX.utils.json_to_sheet(accounts);
    XLSX.utils.book_append_sheet(wb, ws, "Счета");
  }

  // Categories
  const { data: categories } = await supabase
    .from("categories")
    .select("name, type, created_at")
    .order("type, name");

  if (categories?.length) {
    const ws = XLSX.utils.json_to_sheet(categories);
    XLSX.utils.book_append_sheet(wb, ws, "Категории");
  }

  // Exchange rates
  const { data: rates } = await supabase
    .from("exchange_rates")
    .select("effective_date, from_currency, to_currency, rate")
    .order("effective_date", { ascending: false });

  if (rates?.length) {
    const ws = XLSX.utils.json_to_sheet(rates);
    XLSX.utils.book_append_sheet(wb, ws, "Курсы валют");
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `finco-export-${dateStr}.xlsx`);
}
