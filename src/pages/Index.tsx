import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { mockTransactions, MONTHS, MONTH_KEYS, formatAmountShort } from "@/data/mockData";

export default function Dashboard() {
  const stats = useMemo(() => {
    const uzs = mockTransactions.filter((t) => t.currency === "UZS");
    const totalIncome = uzs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = uzs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalTransfer = uzs.filter((t) => t.type === "transfer").reduce((s, t) => s + t.amount, 0);
    const netProfit = totalIncome - totalExpense;

    const chartData = MONTH_KEYS.map((mk, i) => {
      const monthTxns = uzs.filter((t) => t.transaction_date.startsWith(mk));
      return {
        month: MONTHS[i].substring(0, 3),
        income: monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    }).filter((d) => d.income > 0 || d.expense > 0);

    return { totalIncome, totalExpense, totalTransfer, netProfit, chartData };
  }, []);

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

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Дашборд</h1>
        <p className="text-xs text-muted-foreground">Обзор финансов (UZS) • 2024</p>
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
    </div>
  );
}
