import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type ExchangeRate = {
  id: string;
  user_id: string;
  month: string;
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
        .order("month", { ascending: false });
      if (error) throw error;
      return data as ExchangeRate[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (rate: { month: string; from_currency: string; to_currency: string; rate: number }) => {
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

  /** Convert amount from one currency to another using stored rates for a given month */
  const convert = (amount: number, fromCurrency: string, toCurrency: string, month: string): { converted: number; found: boolean } => {
    if (fromCurrency === toCurrency) return { converted: amount, found: true };

    // Direct rate
    const direct = rates.find(
      (r) => r.month === month && r.from_currency === fromCurrency && r.to_currency === toCurrency
    );
    if (direct) return { converted: amount * direct.rate, found: true };

    // Reverse rate
    const reverse = rates.find(
      (r) => r.month === month && r.from_currency === toCurrency && r.to_currency === fromCurrency
    );
    if (reverse && reverse.rate !== 0) return { converted: amount / reverse.rate, found: true };

    return { converted: amount, found: false };
  };

  return { rates, isLoading, addMutation, updateMutation, deleteMutation, convert };
}
