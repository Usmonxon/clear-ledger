import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WALLETS, CASHFLOW_CATEGORIES, PNL_CATEGORIES } from "@/data/mockData";

export default function Settings() {
  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Настройки</h1>
        <p className="text-xs text-muted-foreground">Справочники и конфигурация</p>
      </div>

      <Card className="border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Кошельки (Счета)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {WALLETS.map((w) => (
              <Badge key={w} variant="outline" className="text-xs">{w}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Статьи ДДС (Cashflow)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Доходы</p>
            <div className="flex flex-wrap gap-1.5">
              {CASHFLOW_CATEGORIES.income.map((c) => (
                <Badge key={c} className="text-[10px] bg-income-muted text-income border border-income/20">{c}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Расходы</p>
            <div className="flex flex-wrap gap-1.5">
              {CASHFLOW_CATEGORIES.expense.map((c) => (
                <Badge key={c} className="text-[10px] bg-expense-muted text-expense border border-expense/20">{c}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Категории ОПУ (PnL)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Доходы</p>
            <div className="flex flex-wrap gap-1.5">
              {PNL_CATEGORIES.income.map((c) => (
                <Badge key={c} className="text-[10px] bg-income-muted text-income border border-income/20">{c}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Расходы</p>
            <div className="flex flex-wrap gap-1.5">
              {PNL_CATEGORIES.expense.map((c) => (
                <Badge key={c} className="text-[10px] bg-expense-muted text-expense border border-expense/20">{c}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
