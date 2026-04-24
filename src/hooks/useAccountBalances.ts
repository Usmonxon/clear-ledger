import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";

type TxRow = {
  id: string;
  amount: number;
  type: "income" | "expense" | "transfer" | "dividend";
  wallet_account: string | null;
  from_account: string | null;
  to_account: string | null;
  target_amount: number | null;
};

export type AccountBalance = {
  name: string;
  currency: string;
  current: number;
};

/**
 * Compute current balance for each account by replaying transactions
 * over initial_balance. Optionally exclude a transaction id (useful when
 * editing a transaction so its own impact does not double-count).
 */
export function useAccountBalances(excludeTxnId?: string) {
  const { user } = useAuth();
  const { accounts } = useAccounts();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions-balances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, type, wallet_account, from_account, to_account, target_amount");
      if (error) throw error;
      return data as TxRow[];
    },
    enabled: !!user,
  });

  const balances = useMemo<AccountBalance[]>(() => {
    const map = new Map<string, AccountBalance>();
    accounts.forEach((a) => {
      map.set(a.name, { name: a.name, currency: a.currency, current: a.initial_balance });
    });

    transactions.forEach((t) => {
      if (excludeTxnId && t.id === excludeTxnId) return;
      const accountName = t.wallet_account || t.from_account || "";
      if (t.type === "income") {
        const e = map.get(accountName);
        if (e) e.current += Number(t.amount);
      } else if (t.type === "expense" || t.type === "dividend") {
        const e = map.get(accountName);
        if (e) e.current -= Number(t.amount);
      } else if (t.type === "transfer") {
        const fromName = t.from_account || t.wallet_account;
        if (fromName) {
          const fe = map.get(fromName);
          if (fe) fe.current -= Number(t.amount);
        }
        if (t.to_account) {
          const te = map.get(t.to_account);
          if (te) te.current += Number(t.target_amount != null ? t.target_amount : t.amount);
        }
      }
    });

    return Array.from(map.values());
  }, [accounts, transactions, excludeTxnId]);

  const getBalance = (name: string) => balances.find((b) => b.name === name);

  return { balances, getBalance };
}
