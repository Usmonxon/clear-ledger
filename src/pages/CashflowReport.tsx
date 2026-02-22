import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatAmountShort, type Transaction } from "@/data/mockData";

function buildMonthColumns(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  transactions.forEach((t) => {
    if (t.transaction_date) set.add(t.transaction_date.substring(0, 7));
  });
  return Array.from(set).sort();
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${names[parseInt(month) - 1]} ${year}`;
}

type CurrencyMode = "UZS" | "USD" | "RUB" | "ALL_UZS" | "ALL_USD" | "ALL_RUB";

export default function CashflowReport() {
  const { user } = useAuth();
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("UZS");
  const { convert, isLoading: ratesLoading } = useExchangeRates();

  const isUnified = currencyMode.startsWith("ALL_");
  const baseCurrency = isUnified ? currencyMode.replace("ALL_", "") : currencyMode;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const { monthKeys, data, missingRates } = useMemo(() => {
    const missing = new Set<string>();
    const filtered = isUnified
      ? transactions
      : transactions.filter((t) => t.currency === baseCurrency);
    const monthKeys = buildMonthColumns(filtered);

    const incomeCategories = new Map<string, Map<string, number>>();
    const expenseCategories = new Map<string, Map<string, number>>();
    const transferTotals = new Map<string, number>();

    filtered.forEach((t) => {
      if (!t.transaction_date) return;
      const monthKey = t.transaction_date.substring(0, 7);

      let amt = t.amount;
      if (isUnified && t.currency !== baseCurrency) {
        const txDate = t.transaction_date || monthKey + "-01";
        const result = convert(t.amount, t.currency, baseCurrency, txDate);
        amt = result.converted;
        if (!result.found) missing.add(`${monthKey}: ${t.currency}→${baseCurrency}`);
      }

      const target = t.type === "income" ? incomeCategories : t.type === "expense" ? expenseCategories : null;

      if (target) {
        if (!target.has(t.cashflow_category)) target.set(t.cashflow_category, new Map());
        const catMap = target.get(t.cashflow_category)!;
        catMap.set(monthKey, (catMap.get(monthKey) || 0) + amt);
      }
      if (t.type === "transfer") {
        transferTotals.set(monthKey, (transferTotals.get(monthKey) || 0) + amt);
      }
    });

    const incomeTotals = new Map<string, number>();
    const expenseTotals = new Map<string, number>();
    monthKeys.forEach((mk) => {
      let incSum = 0;
      incomeCategories.forEach((catMap) => { incSum += catMap.get(mk) || 0; });
      incomeTotals.set(mk, incSum);
      let expSum = 0;
      expenseCategories.forEach((catMap) => { expSum += catMap.get(mk) || 0; });
      expenseTotals.set(mk, expSum);
    });

    return { monthKeys, data: { incomeCategories, expenseCategories, transferTotals, incomeTotals, expenseTotals }, missingRates: missing };
  }, [transactions, currencyMode, baseCurrency, isUnified, convert]);

  const yearTotal = (map: Map<string, number>) => { let s = 0; map.forEach((v) => (s += v)); return s; };
  const catYearTotal = (catMap: Map<string, number>) => { let s = 0; catMap.forEach((v) => (s += v)); return s; };

  if (isLoading || ratesLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-xs text-muted-foreground animate-pulse">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ДДС — Отчёт о движении денежных средств</h1>
          <p className="text-xs text-muted-foreground">Cashflow по месяцам (дата ДДС)</p>
        </div>
        <Select value={currencyMode} onValueChange={(v) => setCurrencyMode(v as CurrencyMode)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="UZS">UZS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="RUB">RUB</SelectItem>
            <SelectItem value="ALL_UZS">ВСЕ (в UZS)</SelectItem>
            <SelectItem value="ALL_USD">ВСЕ (в USD)</SelectItem>
            <SelectItem value="ALL_RUB">ВСЕ (в RUB)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {missingRates.size > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 border border-border rounded-md">
          <span className="text-[10px] text-muted-foreground">⚠ Нет курсов:</span>
          {Array.from(missingRates).map((r) => (
            <Badge key={r} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{r}</Badge>
          ))}
        </div>
      )}

      {monthKeys.length === 0 ? (
        <div className="border rounded-md bg-card p-8 text-center text-xs text-muted-foreground">
          Нет данных для отображения. Добавьте операции в разделе «Операции».
        </div>
      ) : (
        <div className="border rounded-md overflow-auto bg-card">
          <table className="w-full">
            <thead>
              <tr className="matrix-header">
                <th className="text-left px-3 py-2 min-w-[200px] sticky left-0 bg-muted z-20">Категория</th>
                <th className="text-right px-3 py-2 min-w-[110px] bg-accent/80">ГОД</th>
                {monthKeys.map((mk) => (
                  <th key={mk} className="text-right px-3 py-2 min-w-[110px]">{monthLabel(mk)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* INCOME */}
              <tr className="bg-income-muted">
                <td className="px-3 py-1.5 font-bold text-sm text-income sticky left-0 bg-income-muted z-10">ДОХОДЫ</td>
                <td className="matrix-cell font-bold text-income">{formatAmountShort(yearTotal(data.incomeTotals))}</td>
                {monthKeys.map((mk) => (
                  <td key={mk} className="matrix-cell font-bold text-income">{formatAmountShort(data.incomeTotals.get(mk) || 0)}</td>
                ))}
              </tr>
              {Array.from(data.incomeCategories.entries()).map(([cat, catMap]) => (
                <tr key={cat} className="hover:bg-muted/30">
                  <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                  <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                  {monthKeys.map((mk) => (
                    <td key={mk} className="matrix-cell">{formatAmountShort(catMap.get(mk) || 0)}</td>
                  ))}
                </tr>
              ))}

              {/* EXPENSE */}
              <tr className="bg-expense-muted">
                <td className="px-3 py-1.5 font-bold text-sm text-expense sticky left-0 bg-expense-muted z-10">РАСХОДЫ</td>
                <td className="matrix-cell font-bold text-expense">{formatAmountShort(yearTotal(data.expenseTotals))}</td>
                {monthKeys.map((mk) => (
                  <td key={mk} className="matrix-cell font-bold text-expense">{formatAmountShort(data.expenseTotals.get(mk) || 0)}</td>
                ))}
              </tr>
              {Array.from(data.expenseCategories.entries()).map(([cat, catMap]) => (
                <tr key={cat} className="hover:bg-muted/30">
                  <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                  <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                  {monthKeys.map((mk) => (
                    <td key={mk} className="matrix-cell">{formatAmountShort(catMap.get(mk) || 0)}</td>
                  ))}
                </tr>
              ))}

              {/* PROFIT */}
              <tr className="bg-accent border-t-2 border-border">
                <td className="px-3 py-1.5 font-bold text-sm sticky left-0 bg-accent z-10">ПРИБЫЛЬ (по кассе)</td>
                <td className="matrix-cell font-bold">
                  {formatAmountShort(yearTotal(data.incomeTotals) - yearTotal(data.expenseTotals))}
                </td>
                {monthKeys.map((mk) => {
                  const profit = (data.incomeTotals.get(mk) || 0) - (data.expenseTotals.get(mk) || 0);
                  return (
                    <td key={mk} className={`matrix-cell font-bold ${profit >= 0 ? "text-income" : "text-expense"}`}>
                      {formatAmountShort(profit)}
                    </td>
                  );
                })}
              </tr>

              {/* TRANSFERS */}
              {yearTotal(data.transferTotals) > 0 && (
                <tr className="bg-transfer-muted/50">
                  <td className="px-3 py-1.5 font-semibold text-sm text-transfer sticky left-0 bg-transfer-muted/50 z-10">ПЕРЕВОДЫ</td>
                  <td className="matrix-cell font-semibold text-transfer">{formatAmountShort(yearTotal(data.transferTotals))}</td>
                  {monthKeys.map((mk) => (
                    <td key={mk} className="matrix-cell text-transfer">{formatAmountShort(data.transferTotals.get(mk) || 0)}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
