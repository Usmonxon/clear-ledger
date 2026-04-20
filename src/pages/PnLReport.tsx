import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PnLSankeyChart from "@/components/PnLSankeyChart";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useCategories } from "@/hooks/useCategories";
import { formatAmountShort, type Transaction } from "@/data/mockData";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileReportTabs } from "@/components/MobileReportTabs";

type Bucket = "income" | "cogs" | "opex" | "all";
type CellClickFn = (opts: { category?: string; monthKey?: string; bucket: Bucket }) => void;

function Amount({ value, onClick, className }: { value: number; onClick?: () => void; className?: string }) {
  if (!onClick) return <>{formatAmountShort(value)}</>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`hover:underline hover:text-primary cursor-pointer ${className || ""}`}
    >
      {formatAmountShort(value)}
    </button>
  );
}

function buildMonthColumns(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  transactions.forEach((t) => {
    if (t.reporting_month) set.add(t.reporting_month);
  });
  return Array.from(set).sort();
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${names[parseInt(month) - 1]} ${year}`;
}

type CurrencyMode = "UZS" | "USD" | "RUB" | "ALL_UZS" | "ALL_USD" | "ALL_RUB";

type CategoryMap = Map<string, Map<string, number>>;
type TotalsMap = Map<string, number>;

function ReportRow({ label, totals, monthKeys, className, cellClass, bucket, onCellClick }: {
  label: string; totals: TotalsMap; monthKeys: string[]; className?: string; cellClass?: string;
  bucket: Bucket; onCellClick?: CellClickFn;
}) {
  let yearTotal = 0;
  totals.forEach((v) => (yearTotal += v));
  return (
    <tr className={className}>
      <td className={`px-3 py-1.5 font-bold text-sm sticky left-0 z-10 ${className}`}>{label}</td>
      <td className={`matrix-cell font-bold ${cellClass}`}>
        <Amount value={yearTotal} onClick={onCellClick ? () => onCellClick({ bucket }) : undefined} />
      </td>
      {monthKeys.map((mk) => (
        <td key={mk} className={`matrix-cell font-bold ${cellClass}`}>
          <Amount value={totals.get(mk) || 0} onClick={onCellClick ? () => onCellClick({ bucket, monthKey: mk }) : undefined} />
        </td>
      ))}
    </tr>
  );
}

function CategoryRows({ categories, monthKeys, bucket, onCellClick }: {
  categories: CategoryMap; monthKeys: string[]; bucket: Bucket; onCellClick?: CellClickFn;
}) {
  return (
    <>
      {Array.from(categories.entries()).map(([cat, catMap]) => {
        let yt = 0;
        catMap.forEach((v) => (yt += v));
        return (
          <tr key={cat} className="hover:bg-muted/30">
            <td className="matrix-subcategory sticky left-0 bg-card z-10">{cat}</td>
            <td className="matrix-cell text-muted-foreground">
              <Amount value={yt} onClick={onCellClick ? () => onCellClick({ bucket, category: cat }) : undefined} />
            </td>
            {monthKeys.map((mk) => (
              <td key={mk} className="matrix-cell">
                <Amount value={catMap.get(mk) || 0} onClick={onCellClick ? () => onCellClick({ bucket, category: cat, monthKey: mk }) : undefined} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function ProfitRow({ label, incomeTotals, expenseTotals, monthKeys, className, onCellClick }: {
  label: string; incomeTotals: TotalsMap; expenseTotals: TotalsMap; monthKeys: string[]; className?: string;
  onCellClick?: CellClickFn;
}) {
  let yearProfit = 0;
  const monthProfits = monthKeys.map((mk) => {
    const p = (incomeTotals.get(mk) || 0) - (expenseTotals.get(mk) || 0);
    yearProfit += p;
    return p;
  });
  return (
    <tr className={`bg-accent border-t-2 border-border ${className}`}>
      <td className="px-3 py-1.5 font-bold text-sm sticky left-0 bg-accent z-10">{label}</td>
      <td className={`matrix-cell font-bold ${yearProfit >= 0 ? "text-income" : "text-expense"}`}>
        <Amount value={yearProfit} onClick={onCellClick ? () => onCellClick({ bucket: "all" }) : undefined} />
      </td>
      {monthProfits.map((p, i) => (
        <td key={monthKeys[i]} className={`matrix-cell font-bold ${p >= 0 ? "text-income" : "text-expense"}`}>
          <Amount value={p} onClick={onCellClick ? () => onCellClick({ bucket: "all", monthKey: monthKeys[i] }) : undefined} />
        </td>
      ))}
    </tr>
  );
}

function ProfitabilityRow({ incomeTotals, expenseTotals, monthKeys }: {
  incomeTotals: TotalsMap; expenseTotals: TotalsMap; monthKeys: string[];
}) {
  let totalInc = 0, totalExp = 0;
  incomeTotals.forEach((v) => (totalInc += v));
  expenseTotals.forEach((v) => (totalExp += v));
  const profitability = totalInc > 0 ? (((totalInc - totalExp) / totalInc) * 100).toFixed(1) : "0.0";
  return (
    <tr className="bg-muted/50">
      <td className="px-3 py-1.5 font-semibold text-xs text-muted-foreground sticky left-0 bg-muted/50 z-10">РЕНТАБЕЛЬНОСТЬ</td>
      <td className="matrix-cell font-semibold text-xs">{profitability}%</td>
      {monthKeys.map((mk) => {
        const inc = incomeTotals.get(mk) || 0;
        const exp = expenseTotals.get(mk) || 0;
        const p = inc > 0 ? (((inc - exp) / inc) * 100).toFixed(1) : "0.0";
        return <td key={mk} className="matrix-cell text-xs text-muted-foreground">{p}%</td>;
      })}
    </tr>
  );
}

export default function PnLReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>("UZS");
  const { convert, isLoading: ratesLoading } = useExchangeRates();
  const { categories: categoryList } = useCategories();
  const isMobile = useIsMobile();

  const handleCellClick: CellClickFn = useCallback(({ category, monthKey, bucket }) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (monthKey) params.set("month", monthKey);
    if (bucket && bucket !== "all") params.set("bucket", bucket);
    if (isUnified) params.set("unified", "1");
    params.set("currency", baseCurrency);
    navigate(`/transactions?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, currencyMode]);

  const isUnified = currencyMode.startsWith("ALL_");
  const baseCurrency = isUnified ? currencyMode.replace("ALL_", "") : currencyMode;

  const cogsNames = useMemo(() => {
    const set = new Set<string>();
    categoryList.filter((c) => c.type === "expense" && c.is_cogs).forEach((c) => set.add(c.name));
    return set;
  }, [categoryList]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("reporting_month", { ascending: true });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const { monthKeys, data, missingRates } = useMemo(() => {
    const missing = new Set<string>();
    const filtered = isUnified
      ? transactions.filter((t) => t.type !== "transfer" && t.type !== "dividend")
      : transactions.filter((t) => t.currency === baseCurrency && t.type !== "transfer" && t.type !== "dividend");
    const monthKeys = buildMonthColumns(filtered);

    const incomeCategories: CategoryMap = new Map();
    const cogsCategories: CategoryMap = new Map();
    const opexCategories: CategoryMap = new Map();

    filtered.forEach((t) => {
      if (!t.reporting_month) return;
      const monthKey = t.reporting_month;

      let amt = t.amount;
      if (isUnified && t.currency !== baseCurrency) {
        const txDate = t.transaction_date || monthKey + "-01";
        const result = convert(t.amount, t.currency, baseCurrency, txDate);
        amt = result.converted;
        if (!result.found) missing.add(`${monthKey}: ${t.currency}→${baseCurrency}`);
      }

      let target: CategoryMap;
      if (t.type === "income") {
        target = incomeCategories;
      } else {
        // expense — split into COGS vs operating
        target = cogsNames.has(t.cashflow_category) ? cogsCategories : opexCategories;
      }
      const cat = t.cashflow_category;
      if (!target.has(cat)) target.set(cat, new Map());
      const catMap = target.get(cat)!;
      catMap.set(monthKey, (catMap.get(monthKey) || 0) + amt);
    });

    const sumTotals = (cats: CategoryMap): TotalsMap => {
      const totals: TotalsMap = new Map();
      monthKeys.forEach((mk) => {
        let sum = 0;
        cats.forEach((catMap) => { sum += catMap.get(mk) || 0; });
        totals.set(mk, sum);
      });
      return totals;
    };

    return {
      monthKeys,
      data: {
        incomeCategories,
        cogsCategories,
        opexCategories,
        incomeTotals: sumTotals(incomeCategories),
        cogsTotals: sumTotals(cogsCategories),
        opexTotals: sumTotals(opexCategories),
        allExpenseTotals: (() => {
          const t: TotalsMap = new Map();
          monthKeys.forEach((mk) => {
            let s = 0;
            cogsCategories.forEach((c) => { s += c.get(mk) || 0; });
            opexCategories.forEach((c) => { s += c.get(mk) || 0; });
            t.set(mk, s);
          });
          return t;
        })(),
      },
      missingRates: missing,
    };
  }, [transactions, currencyMode, baseCurrency, isUnified, convert, cogsNames]);

  const hasCogs = data.cogsCategories.size > 0;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ОПУ — Отчёт о прибылях и убытках</h1>
          <p className="text-xs text-muted-foreground">PnL по месяцу начисления (Месяц ОПУ)</p>
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
              <ReportRow label="ДОХОДЫ" totals={data.incomeTotals} monthKeys={monthKeys} className="bg-income-muted" cellClass="text-income" bucket="income" onCellClick={handleCellClick} />
              <CategoryRows categories={data.incomeCategories} monthKeys={monthKeys} bucket="income" onCellClick={handleCellClick} />

              {/* COGS (if any categories marked) */}
              {hasCogs && (
                <>
                  <ReportRow label="СЕБЕСТОИМОСТЬ" totals={data.cogsTotals} monthKeys={monthKeys} className="bg-amber-500/10" cellClass="text-amber-700 dark:text-amber-400" bucket="cogs" onCellClick={handleCellClick} />
                  <CategoryRows categories={data.cogsCategories} monthKeys={monthKeys} bucket="cogs" onCellClick={handleCellClick} />
                  <ProfitRow label="ВАЛОВАЯ ПРИБЫЛЬ" incomeTotals={data.incomeTotals} expenseTotals={data.cogsTotals} monthKeys={monthKeys} onCellClick={handleCellClick} />
                </>
              )}

              {/* OPERATING EXPENSES */}
              <ReportRow label={hasCogs ? "ОПЕРАЦИОННЫЕ РАСХОДЫ" : "РАСХОДЫ"} totals={data.opexTotals} monthKeys={monthKeys} className="bg-expense-muted" cellClass="text-expense" bucket="opex" onCellClick={handleCellClick} />
              <CategoryRows categories={data.opexCategories} monthKeys={monthKeys} bucket="opex" onCellClick={handleCellClick} />

              {/* NET PROFIT */}
              <ProfitRow label="ЧИСТАЯ ПРИБЫЛЬ" incomeTotals={data.incomeTotals} expenseTotals={data.allExpenseTotals} monthKeys={monthKeys} onCellClick={handleCellClick} />

              {/* PROFITABILITY */}
              <ProfitabilityRow incomeTotals={data.incomeTotals} expenseTotals={data.allExpenseTotals} monthKeys={monthKeys} />
            </tbody>
          </table>
        </div>
      )}

      {monthKeys.length > 0 && (
        <PnLSankeyChart
          incomeCategories={data.incomeCategories}
          expenseCategories={new Map([...data.cogsCategories, ...data.opexCategories])}
          baseCurrency={baseCurrency}
          monthKeys={monthKeys}
        />
      )}
    </div>
  );
}
