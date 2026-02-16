import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockTransactions, MONTHS, MONTH_KEYS, formatAmountShort, type Currency } from "@/data/mockData";

// Cashflow (DDS) report - groups by cashflow_category across months using transaction_date
export default function CashflowReport() {
  const [currency, setCurrency] = useState<string>("UZS");

  const data = useMemo(() => {
    const filtered = mockTransactions.filter((t) => t.currency === currency);

    // Build category hierarchy
    const incomeCategories = new Map<string, Map<string, number>>();
    const expenseCategories = new Map<string, Map<string, number>>();
    const transferTotals = new Map<string, number>();

    filtered.forEach((t) => {
      const monthKey = t.transaction_date.substring(0, 7); // YYYY-MM from transaction_date
      const target = t.type === "income" ? incomeCategories : t.type === "expense" ? expenseCategories : null;

      if (target) {
        if (!target.has(t.cashflow_category)) target.set(t.cashflow_category, new Map());
        const catMap = target.get(t.cashflow_category)!;
        catMap.set(monthKey, (catMap.get(monthKey) || 0) + t.amount);
      }
      if (t.type === "transfer") {
        transferTotals.set(monthKey, (transferTotals.get(monthKey) || 0) + t.amount);
      }
    });

    // Compute totals per month
    const incomeTotals = new Map<string, number>();
    const expenseTotals = new Map<string, number>();

    MONTH_KEYS.forEach((mk) => {
      let incSum = 0;
      incomeCategories.forEach((catMap) => { incSum += catMap.get(mk) || 0; });
      incomeTotals.set(mk, incSum);

      let expSum = 0;
      expenseCategories.forEach((catMap) => { expSum += catMap.get(mk) || 0; });
      expenseTotals.set(mk, expSum);
    });

    return { incomeCategories, expenseCategories, transferTotals, incomeTotals, expenseTotals };
  }, [currency]);

  const yearTotal = (map: Map<string, number>) => {
    let sum = 0;
    map.forEach((v) => (sum += v));
    return sum;
  };

  const catYearTotal = (catMap: Map<string, number>) => {
    let sum = 0;
    catMap.forEach((v) => (sum += v));
    return sum;
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ДДС — Отчёт о движении денежных средств</h1>
          <p className="text-xs text-muted-foreground">Cashflow по месяцам (дата ДДС)</p>
        </div>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="UZS">UZS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="RUB">RUB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md overflow-auto bg-card">
        <table className="w-full">
          <thead>
            <tr className="matrix-header">
              <th className="text-left px-3 py-2 min-w-[200px] sticky left-0 bg-muted z-20">Категория</th>
              <th className="text-right px-3 py-2 min-w-[110px] bg-accent/80">ГОД</th>
              {MONTHS.map((m, i) => (
                <th key={i} className="text-right px-3 py-2 min-w-[110px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* INCOME HEADER */}
            <tr className="bg-income-muted">
              <td className="px-3 py-1.5 font-bold text-sm text-income sticky left-0 bg-income-muted z-10">ДОХОДЫ</td>
              <td className="matrix-cell font-bold text-income">{formatAmountShort(yearTotal(data.incomeTotals))}</td>
              {MONTH_KEYS.map((mk) => (
                <td key={mk} className="matrix-cell font-bold text-income">{formatAmountShort(data.incomeTotals.get(mk) || 0)}</td>
              ))}
            </tr>
            {Array.from(data.incomeCategories.entries()).map(([cat, catMap]) => (
              <tr key={cat} className="hover:bg-muted/30">
                <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                {MONTH_KEYS.map((mk) => (
                  <td key={mk} className="matrix-cell">{formatAmountShort(catMap.get(mk) || 0)}</td>
                ))}
              </tr>
            ))}

            {/* EXPENSE HEADER */}
            <tr className="bg-expense-muted">
              <td className="px-3 py-1.5 font-bold text-sm text-expense sticky left-0 bg-expense-muted z-10">РАСХОДЫ</td>
              <td className="matrix-cell font-bold text-expense">{formatAmountShort(yearTotal(data.expenseTotals))}</td>
              {MONTH_KEYS.map((mk) => (
                <td key={mk} className="matrix-cell font-bold text-expense">{formatAmountShort(data.expenseTotals.get(mk) || 0)}</td>
              ))}
            </tr>
            {Array.from(data.expenseCategories.entries()).map(([cat, catMap]) => (
              <tr key={cat} className="hover:bg-muted/30">
                <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
                <td className="matrix-cell text-muted-foreground">{formatAmountShort(catYearTotal(catMap))}</td>
                {MONTH_KEYS.map((mk) => (
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
              {MONTH_KEYS.map((mk) => {
                const profit = (data.incomeTotals.get(mk) || 0) - (data.expenseTotals.get(mk) || 0);
                return (
                  <td key={mk} className={`matrix-cell font-bold ${profit >= 0 ? "text-income" : "text-expense"}`}>
                    {formatAmountShort(profit)}
                  </td>
                );
              })}
            </tr>

            {/* TRANSFERS */}
            <tr className="bg-transfer-muted/50">
              <td className="px-3 py-1.5 font-semibold text-sm text-transfer sticky left-0 bg-transfer-muted/50 z-10">ПЕРЕВОДЫ</td>
              <td className="matrix-cell font-semibold text-transfer">{formatAmountShort(yearTotal(data.transferTotals))}</td>
              {MONTH_KEYS.map((mk) => (
                <td key={mk} className="matrix-cell text-transfer">{formatAmountShort(data.transferTotals.get(mk) || 0)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
