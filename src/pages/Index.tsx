import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatAmountShort } from "@/data/mockData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

export default function Dashboard() {
  const { user } = useAuth();

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
    const uzs = transactions.filter((t) => t.currency === "UZS");
    const totalIncome = uzs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = uzs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalTransfer = uzs.filter((t) => t.type === "transfer").reduce((s, t) => s + t.amount, 0);
    const netProfit = totalIncome - totalExpense;

    // Build chart by month
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

    return { totalIncome, totalExpense, totalTransfer, netProfit, chartData };
  }, [transactions]);

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
      <div>
        <h1 className="text-lg font-semibold">Дашборд</h1>
        <p className="text-xs text-muted-foreground">Обзор финансов (UZS) • Все периоды</p>
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
            Нет данных. Добавьте операции в разделе «Операции».
          </CardContent>
        </Card>
      )}
    </div>
  );
}
