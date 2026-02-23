import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmountShort } from "@/data/mockData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format } from "date-fns";

type TxRow = {
  id: string;
  transaction_date: string;
  amount: number;
  currency: string;
  type: "income" | "expense" | "transfer";
  cashflow_category: string;
  wallet_account: string;
  description: string | null;
};

function monthLabel(key: string) {
  const [, month] = key.split("-");
  const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return names[parseInt(month) - 1];
}

type Period = "this_month" | "last_month" | "this_year" | "all";

function getPeriodRange(period: Period): { from: string; to: string } | null {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: format(startOfMonth(prev), "yyyy-MM-dd"), to: format(endOfMonth(prev), "yyyy-MM-dd") };
    }
    case "this_year":
      return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
    default:
      return null;
  }
}

const periodLabels: Record<Period, string> = {
  this_month: "Этот месяц",
  last_month: "Прошлый месяц",
  this_year: "Этот год",
  all: "Все время",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("this_month");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, amount, currency, type, cashflow_category, wallet_account, description")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as TxRow[];
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const range = getPeriodRange(period);
    const filtered = range
      ? transactions.filter((t) => t.transaction_date >= range.from && t.transaction_date <= range.to)
      : transactions;

    const uzs = filtered.filter((t) => t.currency === "UZS");
    const totalIncome = uzs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = uzs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalTransfer = uzs.filter((t) => t.type === "transfer").reduce((s, t) => s + t.amount, 0);
    const netProfit = totalIncome - totalExpense;

    let minDate = "";
    let maxDate = "";
    if (filtered.length > 0) {
      const dates = filtered.map((t) => t.transaction_date).sort();
      minDate = dates[0];
      maxDate = dates[dates.length - 1];
    }

    const monthMap = new Map<string, { income: number; expense: number }>();
    uzs.forEach((t) => {
      const mk = t.transaction_date.substring(0, 7);
      if (!monthMap.has(mk)) monthMap.set(mk, { income: 0, expense: 0 });
      const entry = monthMap.get(mk)!;
      if (t.type === "income") entry.income += t.amount;
      else if (t.type === "expense") entry.expense += t.amount;
    });

    const chartData = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mk, v]) => ({ month: monthLabel(mk), ...v }));

    return { totalIncome, totalExpense, totalTransfer, netProfit, chartData, minDate, maxDate };
  }, [transactions, period]);

  const cards = [
    { title: "Доходы", value: stats.totalIncome, icon: TrendingUp, type: "income" as const },
    { title: "Расходы", value: stats.totalExpense, icon: TrendingDown, type: "expense" as const },
    { title: "Прибыль", value: stats.netProfit, icon: Wallet, type: stats.netProfit >= 0 ? "income" as const : "expense" as const },
    { title: "Переводы", value: stats.totalTransfer, icon: ArrowRightLeft, type: "transfer" as const },
  ];

  const colorMap = {
    income: "hsl(152, 55%, 42%)",
    expense: "hsl(350, 65%, 55%)",
    transfer: "hsl(215, 70%, 55%)",
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-xs text-muted-foreground animate-pulse">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Дашборд</h1>
          <p className="text-xs text-muted-foreground">
            Обзор финансов (UZS) • {stats.minDate && stats.maxDate
              ? `${stats.minDate} — ${stats.maxDate}`
              : "Нет данных"}
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {Object.entries(periodLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.title} className="border">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <c.icon className={`h-3.5 w-3.5 text-${c.type}`} />
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className={`text-lg font-bold font-mono text-${c.type}`}>
                {formatAmountShort(c.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">сум</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.chartData.length > 0 ? (
        <Card className="border">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-medium">Доходы vs Расходы по месяцам</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => formatAmountShort(value) + " сум"}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214, 20%, 88%)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="income" name="Доходы" fill={colorMap.income} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Расходы" fill={colorMap.expense} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border">
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            Нет данных за выбранный период.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
