import { useMemo } from "react";
import { formatAmountShort } from "@/data/mockData";
import type { TransactionFull } from "@/components/TransactionSheet";
import { cn } from "@/lib/utils";

type CurrencyMap = Record<string, number>;

function sumByCurrency(txns: TransactionFull[]): CurrencyMap {
  const m: CurrencyMap = {};
  txns.forEach((t) => {
    m[t.currency] = (m[t.currency] || 0) + Number(t.amount);
  });
  return m;
}

function formatMap(m: CurrencyMap, sign: "+" | "-" | "" = "") {
  const entries = Object.entries(m).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return entries
    .map(([cur, v]) => `${sign}${formatAmountShort(Math.abs(v))} ${cur}`)
    .join(" · ");
}

function formatNet(m: CurrencyMap) {
  const entries = Object.entries(m).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return entries
    .map(([cur, v]) => `${v >= 0 ? "+" : "−"}${formatAmountShort(Math.abs(v))} ${cur}`)
    .join(" · ");
}

interface Props {
  transactions: TransactionFull[];
  className?: string;
  compact?: boolean;
}

export function TransactionTotals({ transactions, className, compact }: Props) {
  const totals = useMemo(() => {
    const income = sumByCurrency(transactions.filter((t) => t.type === "income"));
    const expense = sumByCurrency(transactions.filter((t) => t.type === "expense"));
    const transfer = sumByCurrency(transactions.filter((t) => t.type === "transfer"));
    const dividend = sumByCurrency(transactions.filter((t) => t.type === "dividend"));

    const currencies = new Set([...Object.keys(income), ...Object.keys(expense)]);
    const net: CurrencyMap = {};
    currencies.forEach((c) => {
      net[c] = (income[c] || 0) - (expense[c] || 0);
    });

    return { income, expense, transfer, dividend, net };
  }, [transactions]);

  if (transactions.length === 0) return null;

  const incomeStr = formatMap(totals.income, "+");
  const expenseStr = formatMap(totals.expense, "−");
  const netStr = formatNet(totals.net);
  const transferStr = formatMap(totals.transfer);
  const dividendStr = formatMap(totals.dividend, "−");

  const pill = "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        compact && "gap-1",
        className,
      )}
    >
      {incomeStr && (
        <span className={cn(pill, "border-income/20 bg-income-muted text-income")}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Доход</span>
          <span>{incomeStr}</span>
        </span>
      )}
      {expenseStr && (
        <span className={cn(pill, "border-expense/20 bg-expense-muted text-expense")}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Расход</span>
          <span>{expenseStr}</span>
        </span>
      )}
      {netStr && (incomeStr || expenseStr) && (
        <span className={cn(pill, "border-primary/30 bg-primary/10 text-foreground font-semibold")}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Итого</span>
          <span>{netStr}</span>
        </span>
      )}
      {transferStr && (
        <span className={cn(pill, "border-transfer/20 bg-transfer-muted text-transfer")}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Переводы</span>
          <span>{transferStr}</span>
        </span>
      )}
      {dividendStr && (
        <span className={cn(pill, "border-dividend/20 bg-dividend-muted text-dividend")}>
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Дивиденды</span>
          <span>{dividendStr}</span>
        </span>
      )}
    </div>
  );
}
