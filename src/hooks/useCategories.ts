import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CASHFLOW_CATEGORIES } from "@/data/mockData";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense" | "transfer" | "dividend";
  is_cogs: boolean;
  created_at: string;
};

export function useCategories() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("type")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: Category["type"] }) => {
      const { error } = await supabase.from("categories").insert({ name, type, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Категория добавлена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Категория удалена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const toggleCogsMutation = useMutation({
    mutationFn: async ({ id, is_cogs }: { id: string; is_cogs: boolean }) => {
      const { error } = await supabase.from("categories").update({ is_cogs } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Себестоимость обновлена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const trimmed = newName.trim();
      if (!trimmed) throw new Error("Название не может быть пустым");
      const cat = categories.find((c) => c.id === id);
      if (!cat) throw new Error("Категория не найдена");
      const oldName = cat.name;
      if (oldName === trimmed) return;

      // Prevent duplicates within same type
      const dup = categories.find(
        (c) => c.type === cat.type && c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (dup) throw new Error("Категория с таким названием уже существует");

      const { error } = await supabase.from("categories").update({ name: trimmed }).eq("id", id);
      if (error) throw error;

      // Cascade rename to existing transactions (category names are stored as text)
      if (cat.type === "income" || cat.type === "expense") {
        await supabase
          .from("transactions")
          .update({ pnl_category: trimmed })
          .eq("user_id", user!.id)
          .eq("pnl_category", oldName);
      }
      await supabase
        .from("transactions")
        .update({ cashflow_category: trimmed })
        .eq("user_id", user!.id)
        .eq("cashflow_category", oldName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Категория переименована" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });


  // Seed defaults if none exist
  const seedDefaults = async () => {
    if (!user || categories.length > 0) return;
    const rows = [
      ...CASHFLOW_CATEGORIES.income.map((name) => ({ name, type: "income" as const, user_id: user.id })),
      ...CASHFLOW_CATEGORIES.expense.map((name) => ({ name, type: "expense" as const, user_id: user.id })),
      ...CASHFLOW_CATEGORIES.transfer.map((name) => ({ name, type: "transfer" as const, user_id: user.id })),
      ...CASHFLOW_CATEGORIES.dividend.map((name) => ({ name, type: "dividend" as const, user_id: user.id })),
    ];
    await supabase.from("categories").insert(rows);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const getCategoryNames = (type: "income" | "expense" | "transfer" | "dividend") =>
    categories.filter((c) => c.type === type).map((c) => c.name);

  return { categories, isLoading, addMutation, deleteMutation, toggleCogsMutation, seedDefaults, getCategoryNames };
}
