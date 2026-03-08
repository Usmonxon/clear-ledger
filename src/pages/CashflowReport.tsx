import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatAmountShort, type Transaction } from "@/data/mockData";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileReportTabs } from "@/components/MobileReportTabs";

type CurrencyMode = "UZS" | "USD" | "RUB" | "ALL_UZS" | "ALL_USD" | "ALL_RUB";
type GroupBy = "month" | "day";

function buildColumns(transactions: Transaction[], groupBy: GroupBy, selectedMonth?: string): string[] {
  const set = new Set<string>();
  transactions.forEach((t) => {
    if (!t.transaction_date) return;
    if (groupBy === "month") {
      set.add(t.transaction_date.substring(0, 7));
    } else {
      const mk = t.transaction_date.substring(0, 7);
      if (selectedMonth && mk === selectedMonth) {
        set.add(t.transaction_date);
      }
    }
  });
  return Array.from(set).sort();
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${names[parseInt(month) - 1]} ${year}`;
}

function dayLabel(key: string) {
  const parts = key.split("-");
  return `${parts[2]}.${parts[1]}`;
}

function getAvailableMonths(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  transactions.forEach((t) => {
    if (t.transaction_date) set.add(t.transaction_date.substring(0, 7));
  });
  return Array.from(set).sort();
}

export default function CashflowReport() {
  const { user } = useAuth();
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("UZS");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const isMobile = useIsMobile();
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

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);

  // Auto-select latest month when switching to day view
  const activeMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : "");

  const { columnKeys, data, missingRates } = useMemo(() => {
    const missing = new Set<string>();
    const filtered = isUnified
      ? transactions
      : transactions.filter((t) => t.currency === baseCurrency);
    const columnKeys = buildColumns(filtered, groupBy, groupBy === "day" ? activeMonth : undefined);

    const incomeCategories = new Map<string, Map<string, number>>();
    const expenseCategories = new Map<string, Map<string, number>>();
    const transferTotals = new Map<string, number>();
    const dividendCategories = new Map<string, Map<string, number>>();
    const dividendTotals = new Map<string, number>();

    filtered.forEach((t) => {
      if (!t.transaction_date) return;
      let colKey: string;
      if (groupBy === "month") {
        colKey = t.transaction_date.substring(0, 7);
      } else {
        const mk = t.transaction_date.substring(0, 7);
        if (mk !== activeMonth) return;
        colKey = t.transaction_date;
      }

      let amt = t.amount;
      if (isUnified && t.currency !== baseCurrency) {
        const txDate = t.transaction_date || colKey;
        const result = convert(t.amount, t.currency, baseCurrency, txDate);
        amt = result.converted;
        if (!result.found) missing.add(`${colKey}: ${t.currency}→${baseCurrency}`);
      }

      const target = t.type === "income" ? incomeCategories : t.type === "expense" ? expenseCategories : null;

      if (target) {
        if (!target.has(t.cashflow_category)) target.set(t.cashflow_category, new Map());
        const catMap = target.get(t.cashflow_category)!;
        catMap.set(colKey, (catMap.get(colKey) || 0) + amt);
      }
      if (t.type === "transfer") {
        transferTotals.set(colKey, (transferTotals.get(colKey) || 0) + amt);
      }
      if (t.type === "dividend") {
        if (!dividendCategories.has(t.cashflow_category)) dividendCategories.set(t.cashflow_category, new Map());
        const catMap = dividendCategories.get(t.cashflow_category)!;
        catMap.set(colKey, (catMap.get(colKey) || 0) + amt);
        dividendTotals.set(colKey, (dividendTotals.get(colKey) || 0) + amt);
      }
    });

    const incomeTotals = new Map<string, number>();
    const expenseTotals = new Map<string, number>();
    columnKeys.forEach((ck) => {
      let incSum = 0;
      incomeCategories.forEach((catMap) => { incSum += catMap.get(ck) || 0; });
      incomeTotals.set(ck, incSum);
      let expSum = 0;
      expenseCategories.forEach((catMap) => { expSum += catMap.get(ck) || 0; });
      expenseTotals.set(ck, expSum);
    });

    return { columnKeys, data: { incomeCategories, expenseCategories, transferTotals, dividendCategories, dividendTotals, incomeTotals, expenseTotals }, missingRates: missing };
  }, [transactions, currencyMode, baseCurrency, isUnified, convert, groupBy, activeMonth]);

  const yearTotal = (map: Map<string, number>) => { let s = 0; map.forEach((v) => (s += v)); return s; };
  const catYearTotal = (catMap: Map<string, number>) => { let s = 0; catMap.forEach((v) => (s += v)); return s; };
  const colLabel = groupBy === "month" ? monthLabel : dayLabel;
  const totalLabel = groupBy === "month" ? "ГОД" : "ИТОГО";

  if (isLoading || ratesLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-xs text-muted-foreground animate-pulse">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {isMobile && <MobileReportTabs />}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">ДДС — Отчёт о движении денежных средств</h1>
          <p className="text-xs text-muted-foreground">
            Cashflow {groupBy === "month" ? "по месяцам" : `по дням (${monthLabel(activeMonth)})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="month">По месяцам</SelectItem>
              <SelectItem value="day">По дням</SelectItem>
            </SelectContent>
          </Select>
          {groupBy === "day" && availableMonths.length > 0 && (
            <Select value={activeMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
      </div>

      {missingRates.size > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 border border-border rounded-md">
          <span className="text-[10px] text-muted-foreground">⚠ Нет курсов:</span>
          {Array.from(missingRates).map((r) => (
            <Badge key={r} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{r}</Badge>
          ))}
        </div>
      )}

      {columnKeys.length === 0 ? (
        <div className="border rounded-md bg-card p-8 text-center text-xs text-muted-foreground">
          Нет данных для отображения. {groupBy === "day" ? "Выберите другой месяц или добавьте операции." : "Добавьте операции в разделе «Операции»."}
        </div>
      ) : (
        <div className="border rounded-md overflow-auto bg-card">
          <table className="w-full">
            <thead>
              <tr className="matrix-header">
                <th className="text-left px-3 py-2 min-w-[200px] sticky left-0 bg-muted z-20">Категория</th>
                <th className="text-right px-3 py-2 min-w-[110px] bg-accent/80">{totalLabel}</th>
                {columnKeys.map((ck) => (
                  <th key={ck} className="text-right px-3 py-2 min-w-[90px]">{colLabel(ck)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* INCOME */}
              <tr className="bg-income-muted">
                <td className="px-3 py-1.5 font-bold text-sm text-income sticky left-0 bg-income-muted z-10">ДОХОДЫ</td>
                <td className="matrix-cell font-bold text-income">{formatAmountShort(yearTotal(data.incomeTotals))}</td>
                {columnKeys.map((ck) => (
                  <td key={ck} className="matrix-cell font-bold text-income">{formatAmountShort(data.incomeTotals.get(ck) || 0)}</td>
                ))}
              </tr>
              {Array.from(data.incomeCategories.entries()).map(([cat, catMap]) => (
                <tr key={cat} className="hover:bg-muted/30">
                  <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                  <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                  {columnKeys.map((ck) => (
                    <td key={ck} className="matrix-cell">{formatAmountShort(catMap.get(ck) || 0)}</td>
                  ))}
                </tr>
              ))}

              {/* EXPENSE */}
              <tr className="bg-expense-muted">
                <td className="px-3 py-1.5 font-bold text-sm text-expense sticky left-0 bg-expense-muted z-10">РАСХОДЫ</td>
                <td className="matrix-cell font-bold text-expense">{formatAmountShort(yearTotal(data.expenseTotals))}</td>
                {columnKeys.map((ck) => (
                  <td key={ck} className="matrix-cell font-bold text-expense">{formatAmountShort(data.expenseTotals.get(ck) || 0)}</td>
                ))}
              </tr>
              {Array.from(data.expenseCategories.entries()).map(([cat, catMap]) => (
                <tr key={cat} className="hover:bg-muted/30">
                  <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                  <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                  {columnKeys.map((ck) => (
                    <td key={ck} className="matrix-cell">{formatAmountShort(catMap.get(ck) || 0)}</td>
                  ))}
                </tr>
              ))}

              {/* PROFIT */}
              <tr className="bg-accent border-t-2 border-border">
                <td className="px-3 py-1.5 font-bold text-sm sticky left-0 bg-accent z-10">ПРИБЫЛЬ (по кассе)</td>
                <td className="matrix-cell font-bold">
                  {formatAmountShort(yearTotal(data.incomeTotals) - yearTotal(data.expenseTotals))}
                </td>
                {columnKeys.map((ck) => {
                  const profit = (data.incomeTotals.get(ck) || 0) - (data.expenseTotals.get(ck) || 0);
                  return (
                    <td key={ck} className={`matrix-cell font-bold ${profit >= 0 ? "text-income" : "text-expense"}`}>
                      {formatAmountShort(profit)}
                    </td>
                  );
                })}
              </tr>

              {/* DIVIDENDS */}
              {yearTotal(data.dividendTotals) > 0 && (
                <>
                  <tr className="bg-dividend-muted">
                    <td className="px-3 py-1.5 font-bold text-sm text-dividend sticky left-0 bg-dividend-muted z-10">ДИВИДЕНДЫ</td>
                    <td className="matrix-cell font-bold text-dividend">{formatAmountShort(yearTotal(data.dividendTotals))}</td>
                    {columnKeys.map((ck) => (
                      <td key={ck} className="matrix-cell font-bold text-dividend">{formatAmountShort(data.dividendTotals.get(ck) || 0)}</td>
                    ))}
                  </tr>
                  {Array.from(data.dividendCategories.entries()).map(([cat, catMap]) => (
                    <tr key={cat} className="hover:bg-muted/30">
                      <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                      <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                      {columnKeys.map((ck) => (
                        <td key={ck} className="matrix-cell">{formatAmountShort(catMap.get(ck) || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {/* TRANSFERS */}
              {yearTotal(data.transferTotals) > 0 && (
                <tr className="bg-transfer-muted/50">
                  <td className="px-3 py-1.5 font-semibold text-sm text-transfer sticky left-0 bg-transfer-muted/50 z-10">ПЕРЕВОДЫ</td>
                  <td className="matrix-cell font-semibold text-transfer">{formatAmountShort(yearTotal(data.transferTotals))}</td>
                  {columnKeys.map((ck) => (
                    <td key={ck} className="matrix-cell text-transfer">{formatAmountShort(data.transferTotals.get(ck) || 0)}</td>
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
