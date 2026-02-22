import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export type ExchangeRate = {
  id: string;
  user_id: string;
  effective_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  created_at: string;
  updated_at: string;
};

export function useExchangeRates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["exchange_rates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data as ExchangeRate[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (rate: { effective_date: string; from_currency: string; to_currency: string; rate: number }) => {
      const { error } = await supabase.from("exchange_rates").insert({ ...rate, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast({ title: "Курс добавлен" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase.from("exchange_rates").update({ rate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast({ title: "Курс обновлён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exchange_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast({ title: "Курс удалён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  /**
   * Find the applicable rate for a given transaction date.
   * Logic: find the latest rate entry whose effective_date <= txDate for the given currency pair.
   * Rates are sorted desc by effective_date already.
   */
  const convert = useCallback((amount: number, fromCurrency: string, toCurrency: string, txDate: string): { converted: number; found: boolean } => {
    if (fromCurrency === toCurrency) return { converted: amount, found: true };

    // Direct rate: find latest effective_date <= txDate
    const direct = rates.find(
      (r) => r.from_currency === fromCurrency && r.to_currency === toCurrency && r.effective_date <= txDate
    );
    if (direct) return { converted: amount * direct.rate, found: true };

    // Reverse rate
    const reverse = rates.find(
      (r) => r.from_currency === toCurrency && r.to_currency === fromCurrency && r.effective_date <= txDate
    );
    if (reverse && reverse.rate !== 0) return { converted: amount / reverse.rate, found: true };

    return { converted: amount, found: false };
  }, [rates]);

  return { rates, isLoading, addMutation, updateMutation, deleteMutation, convert };
}
