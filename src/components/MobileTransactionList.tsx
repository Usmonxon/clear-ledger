import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Search, Plus, ShoppingCart, TrendingUp, ArrowLeftRight, Briefcase, Coffee, Home, Zap, CreditCard, DollarSign, Building2, Truck, BookOpen, Wrench, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatAmountShort, type TransactionType } from "@/data/mockData";
import type { TransactionFull } from "@/components/TransactionSheet";

const categoryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CRM: Briefcase,
  amoCRM: Briefcase,
  Битрикс24: Building2,
  Operatsion: Zap,
  Boshqa: Gift,
  "operatsion.oylik": CreditCard,
  "operatsion.yo'lkira": Truck,
  "operatsion.ofis": Home,
  "operatsion.boshqa": Coffee,
  "dasturlar.amoCRM": Briefcase,
  "dasturlar.Bitrix24": Building2,
  "dasturlar.iSpring": BookOpen,
  sherikchilik: DollarSign,
  "kommissiya.bank": CreditCard,
  "kommissiya.plastik": CreditCard,
  "kommissiya.dollar": DollarSign,
  kurs: TrendingUp,
  arenda: Home,
  PEREVOD: ArrowLeftRight,
};

const typeColors: Record<TransactionType, string> = {
  income: "bg-income",
  expense: "bg-expense",
  transfer: "bg-transfer",
  dividend: "bg-dividend",
};


interface Props {
  transactions: TransactionFull[];
  isLoading: boolean;
  onAdd: () => void;
  onSelect: (t: TransactionFull) => void;
}

export function MobileTransactionList({ transactions, isLoading, onAdd, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          t.description?.toLowerCase().includes(q) ||
          t.cashflow_category.toLowerCase().includes(q) ||
          t.wallet_account.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TransactionFull[]>();
    filtered.forEach((t) => {
      const key = t.transaction_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="flex flex-col h-full pb-28">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10 text-sm rounded-xl bg-muted border-0"
          />
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-auto px-4">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Загрузка...</p>
        ) : grouped.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Нет операций</p>
        ) : (
          grouped.map(([dateStr, txns]) => (
            <div key={dateStr} className="mb-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {format(parseISO(dateStr), "d MMMM", { locale: ru }).toUpperCase()}
              </h3>
              <div className="space-y-0.5">
                {txns.map((t) => {
                  const IconComp = categoryIconMap[t.cashflow_category] || ShoppingCart;
                  const amountColor = t.type === "income" ? "text-income" : t.type === "expense" ? "text-expense" : t.type === "dividend" ? "text-dividend" : "text-transfer";
                  const sign = t.type === "income" ? "+" : (t.type === "expense" || t.type === "dividend") ? "−" : "";
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t)}
                      className="w-full flex items-center gap-3 py-3 px-1 rounded-lg active:bg-muted transition-colors text-left"
                    >
                      <div className={`h-10 w-10 rounded-full ${typeColors[t.type]} flex items-center justify-center shrink-0`}>
                        <IconComp className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.cashflow_category}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.type === "transfer" && t.from_account && t.to_account
                            ? `${t.from_account} → ${t.to_account}`
                            : t.wallet_account}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-mono font-medium ${amountColor}`}>
                          {sign}{formatAmountShort(t.amount)} {t.currency}
                        </p>
                        {t.description && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{t.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Period filter */}
      <div className="fixed bottom-14 inset-x-0 bg-card/95 backdrop-blur-sm border-t px-3 py-2 flex gap-1.5 justify-center pb-safe-offset">
        {periods.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPeriodIdx(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === periodIdx
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={onAdd}
        className="fixed right-5 bottom-32 h-14 w-14 rounded-full bg-income text-income-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}
