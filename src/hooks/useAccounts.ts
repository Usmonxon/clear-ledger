import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { WALLETS } from "@/data/mockData";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  initial_balance: number;
  created_at: string;
  updated_at: string;
};

export function useAccounts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async ({ name, currency, initial_balance }: { name: string; currency: string; initial_balance: number }) => {
      const { error } = await supabase.from("accounts").insert({ name, currency, initial_balance, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Счёт добавлен" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, currency, initial_balance }: { id: string; name: string; currency: string; initial_balance: number }) => {
      const { error } = await supabase.from("accounts").update({ name, currency, initial_balance }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Счёт обновлён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({ title: "Счёт удалён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  // Seed defaults if none exist
  const seedDefaults = async () => {
    if (!user || accounts.length > 0) return;
    const rows = WALLETS.map((name) => ({ name, currency: "UZS", initial_balance: 0, user_id: user.id }));
    await supabase.from("accounts").insert(rows);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const accountNames = accounts.map((a) => a.name);

  return { accounts, isLoading, addMutation, updateMutation, deleteMutation, seedDefaults, accountNames };
}
