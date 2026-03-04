import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { formatAmountShort } from "@/data/mockData";

type TxRow = {
  amount: number;
  type: string;
  wallet_account: string;
  from_account: string | null;
  to_account: string | null;
  currency: string;
  target_currency: string | null;
  target_amount: number | null;
};

export default function Accounts() {
  const { user } = useAuth();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, wallet_account, from_account, to_account, currency, target_currency, target_amount");
      if (error) throw error;
      return data as TxRow[];
    },
    enabled: !!user,
  });

  const balances = useMemo(() => {
    const balanceMap = new Map<string, { initial: number; current: number; currency: string }>();
    accounts.forEach((a) => {
      balanceMap.set(a.name, { initial: a.initial_balance, current: a.initial_balance, currency: a.currency });
    });

    transactions.forEach((t) => {
      const accountName = t.wallet_account || t.from_account || "";
      if (t.type === "income") {
        const entry = balanceMap.get(accountName);
        if (entry) entry.current += t.amount;
      } else if (t.type === "expense" || t.type === "dividend") {
        const entry = balanceMap.get(accountName);
        if (entry) entry.current -= t.amount;
      } else if (t.type === "transfer") {
        // Deduct from source
        const fromName = t.from_account || t.wallet_account;
        if (fromName) {
          const fromEntry = balanceMap.get(fromName);
          if (fromEntry) fromEntry.current -= t.amount;
        }
        // Add to destination — use target_amount for cross-currency, otherwise amount
        if (t.to_account) {
          const toEntry = balanceMap.get(t.to_account);
          if (toEntry) {
            toEntry.current += (t.target_amount != null ? t.target_amount : t.amount);
          }
        }
      }
    });

    return accounts.map((a) => ({
      ...a,
      current: balanceMap.get(a.name)?.current ?? a.initial_balance,
    }));
  }, [accounts, transactions]);

  const totalByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    balances.forEach((b) => {
      map.set(b.currency, (map.get(b.currency) || 0) + b.current);
    });
    return Array.from(map.entries());
  }, [balances]);

  const isLoading = accountsLoading || txLoading;

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-xs text-muted-foreground animate-pulse">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Счета</h1>
        <p className="text-xs text-muted-foreground">Текущие остатки по всем счетам</p>
      </div>

      {totalByCurrency.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {totalByCurrency.map(([currency, total]) => (
            <Card key={currency} className="border">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Итого {currency}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-lg font-bold font-mono ${total >= 0 ? "text-income" : "text-expense"}`}>
                  {formatAmountShort(total)}
                </p>
                <p className="text-[10px] text-muted-foreground">{currency}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {balances.length === 0 ? (
        <Card className="border">
          <CardContent className="p-8 text-center text-xs text-muted-foreground">
            Нет счетов. Создайте их в разделе «Настройки».
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map((account) => {
            const change = account.current - account.initial_balance;
            return (
              <Card key={account.id} className="border">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      {account.name}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {account.currency}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Текущий остаток</p>
                    <p className={`text-xl font-bold font-mono ${account.current >= 0 ? "text-foreground" : "text-expense"}`}>
                      {formatAmountShort(account.current)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                    <span>Начальный: {formatAmountShort(account.initial_balance)}</span>
                    <span className={`flex items-center gap-0.5 font-mono ${change >= 0 ? "text-income" : "text-expense"}`}>
                      {change >= 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {formatAmountShort(Math.abs(change))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
