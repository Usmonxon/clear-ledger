import { useMemo, useState } from "react";
import { Sankey, Tooltip, Layer, Rectangle } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatAmountShort } from "@/data/mockData";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  incomeCategories: Map<string, Map<string, number>>;
  expenseCategories: Map<string, Map<string, number>>;
  baseCurrency: string;
  monthKeys: string[];
}

type PeriodOption = "all" | "3m" | "6m" | "1y";

const INCOME_COLOR = "hsl(142, 71%, 45%)";
const EXPENSE_COLOR = "hsl(0, 84%, 60%)";
const PROFIT_COLOR = "hsl(142, 71%, 45%)";
const LOSS_COLOR = "hsl(0, 84%, 60%)";

function filterMonthKeys(monthKeys: string[], period: PeriodOption): string[] {
  if (period === "all" || monthKeys.length === 0) return monthKeys;
  const sorted = [...monthKeys].sort();
  const last = sorted[sorted.length - 1];
  const [y, m] = last.split("-").map(Number);
  const lastDate = new Date(y, m - 1, 1);

  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const cutoff = new Date(lastDate);
  cutoff.setMonth(cutoff.getMonth() - months + 1);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;

  return sorted.filter((k) => k >= cutoffKey);
}

function buildSankeyData(
  incomeCategories: Map<string, Map<string, number>>,
  expenseCategories: Map<string, Map<string, number>>,
  filteredMonths: string[]
) {
  const monthSet = new Set(filteredMonths);

  const incomeTotals = new Map<string, number>();
  incomeCategories.forEach((catMap, cat) => {
    let sum = 0;
    catMap.forEach((v, mk) => { if (monthSet.has(mk)) sum += v; });
    if (sum > 0) incomeTotals.set(cat, sum);
  });

  const expenseTotals = new Map<string, number>();
  expenseCategories.forEach((catMap, cat) => {
    let sum = 0;
    catMap.forEach((v, mk) => { if (monthSet.has(mk)) sum += v; });
    if (sum > 0) expenseTotals.set(cat, sum);
  });

  const totalIncome = Array.from(incomeTotals.values()).reduce((a, b) => a + b, 0);
  const totalExpense = Array.from(expenseTotals.values()).reduce((a, b) => a + b, 0);
  const netProfit = totalIncome - totalExpense;

  if (totalIncome === 0 && totalExpense === 0) return null;

  const nodes: { name: string }[] = [];
  const links: { source: number; target: number; value: number }[] = [];

  // Income category nodes (left side)
  const incomeEntries = Array.from(incomeTotals.entries()).sort((a, b) => b[1] - a[1]);
  incomeEntries.forEach(([cat]) => nodes.push({ name: cat }));

  // Revenue node (center)
  const revenueIdx = nodes.length;
  nodes.push({ name: "Выручка" });

  // Expense category nodes (right side)
  const expenseEntries = Array.from(expenseTotals.entries()).sort((a, b) => b[1] - a[1]);
  expenseEntries.forEach(([cat]) => nodes.push({ name: cat }));

  // Profit/Loss node
  const profitIdx = nodes.length;
  nodes.push({ name: netProfit >= 0 ? "Прибыль" : "Убыток" });

  // Links: income cats → revenue
  incomeEntries.forEach(([, val], i) => {
    links.push({ source: i, target: revenueIdx, value: val });
  });

  // Links: revenue → expense cats
  const expenseStartIdx = revenueIdx + 1;
  expenseEntries.forEach(([, val], i) => {
    links.push({ source: revenueIdx, target: expenseStartIdx + i, value: val });
  });

  // Link: revenue → profit/loss
  if (Math.abs(netProfit) > 0) {
    links.push({ source: revenueIdx, target: profitIdx, value: Math.abs(netProfit) });
  }

  return {
    nodes,
    links,
    revenueIdx,
    profitIdx,
    incomeCount: incomeEntries.length,
    expenseCount: expenseEntries.length,
    totalIncome,
    totalExpense,
    netProfit,
  };
}

function CustomNode(props: any) {
  const { x, y, width, height, index, payload } = props;
  const meta = props.meta;
  if (!meta) return <Rectangle x={x} y={y} width={width} height={height} fill="hsl(var(--muted))" />;

  let fill = INCOME_COLOR;
  if (index === meta.revenueIdx) {
    fill = "hsl(var(--primary))";
  } else if (index === meta.profitIdx) {
    fill = meta.netProfit >= 0 ? PROFIT_COLOR : LOSS_COLOR;
  } else if (index > meta.revenueIdx && index < meta.profitIdx) {
    fill = EXPENSE_COLOR;
  }

  const isRight = index >= meta.revenueIdx;
  const textAnchor = isRight ? "start" : "end";
  const textX = isRight ? x + width + 6 : x - 6;

  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={3} />
      {height > 12 && (
        <text
          x={textX}
          y={y + height / 2}
          textAnchor={textAnchor}
          dominantBaseline="central"
          fontSize={11}
          fill="hsl(var(--foreground))"
          fontWeight={index === meta.revenueIdx || index === meta.profitIdx ? 700 : 400}
        >
          {payload.name}
        </text>
      )}
    </Layer>
  );
}

function CustomLink(props: any) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, index, payload } = props;
  const meta = props.meta;

  const isIncomeLink = payload.source.depth === 0;
  const gradientId = `sankey-grad-${index}`;
  const startColor = isIncomeLink ? INCOME_COLOR : "hsl(var(--primary))";
  const endColor = isIncomeLink
    ? "hsl(var(--primary))"
    : payload.target.name === "Прибыль"
    ? PROFIT_COLOR
    : payload.target.name === "Убыток"
    ? LOSS_COLOR
    : EXPENSE_COLOR;

  return (
    <Layer>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={startColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={endColor} stopOpacity={0.4} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={linkWidth}
        strokeOpacity={0.6}
      />
    </Layer>
  );
}

export default function PnLSankeyChart({ incomeCategories, expenseCategories, baseCurrency, monthKeys }: Props) {
  const [open, setOpen] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>("all");
  const isMobile = useIsMobile();

  const filteredMonths = useMemo(() => filterMonthKeys(monthKeys, period), [monthKeys, period]);

  const sankeyData = useMemo(
    () => buildSankeyData(incomeCategories, expenseCategories, filteredMonths),
    [incomeCategories, expenseCategories, filteredMonths]
  );

  if (!sankeyData) return null;

  const chartWidth = isMobile ? 600 : 900;
  const chartHeight = Math.max(350, (sankeyData.nodes.length - 2) * 28 + 100);

  const meta = {
    revenueIdx: sankeyData.revenueIdx,
    profitIdx: sankeyData.profitIdx,
    netProfit: sankeyData.netProfit,
  };

  return (
    <Card className="bg-card border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between px-4 py-3">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:underline">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Санкей-диаграмма
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Весь период</SelectItem>
                <SelectItem value="3m">3 мес</SelectItem>
                <SelectItem value="6m">6 мес</SelectItem>
                <SelectItem value="1y">1 год</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{baseCurrency}</span>
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="p-0 overflow-x-auto">
            <div style={{ minWidth: chartWidth, height: chartHeight }} className="mx-auto">
              <Sankey
                width={chartWidth}
                height={chartHeight}
                data={{ nodes: sankeyData.nodes, links: sankeyData.links }}
                nodeWidth={10}
                nodePadding={14}
                margin={{ top: 20, right: 160, bottom: 20, left: 160 }}
                link={<CustomLink meta={meta} />}
                node={<CustomNode meta={meta} />}
              >
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const item = payload[0]?.payload?.payload ?? payload[0]?.payload;
                    if (!item) return null;
                    const name = item.name || `${item.source?.name} → ${item.target?.name}`;
                    const value = item.value;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
                        <p className="font-medium">{name}</p>
                        <p className="text-muted-foreground">{formatAmountShort(value)} {baseCurrency}</p>
                      </div>
                    );
                  }}
                />
              </Sankey>
            </div>
            <div className="flex justify-center gap-6 pb-3 text-xs text-muted-foreground">
              <span>
                Доходы: <strong className="text-income">{formatAmountShort(sankeyData.totalIncome)}</strong>
              </span>
              <span>
                Расходы: <strong className="text-expense">{formatAmountShort(sankeyData.totalExpense)}</strong>
              </span>
              <span>
                {sankeyData.netProfit >= 0 ? "Прибыль" : "Убыток"}:{" "}
                <strong className={sankeyData.netProfit >= 0 ? "text-income" : "text-expense"}>
                  {formatAmountShort(Math.abs(sankeyData.netProfit))}
                </strong>
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
