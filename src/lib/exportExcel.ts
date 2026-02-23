import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

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
