import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatAmountShort, type Transaction, type TransactionType } from "@/data/mockData";
import { TransactionSheet } from "@/components/TransactionSheet";

const typeStyles: Record<TransactionType, string> = {
  income: "bg-income-muted text-income border-income/20",
  expense: "bg-expense-muted text-expense border-expense/20",
  transfer: "bg-transfer-muted text-transfer border-transfer/20",
};

const typeLabels: Record<TransactionType, string> = {
  income: "ДОХОД",
  expense: "РАСХОД",
  transfer: "ПЕРЕВОД",
};

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  // ─── Insert ───────────────────────────────────────────────────────────────
  const insertMutation = useMutation({
    mutationFn: async (txn: Omit<Transaction, "id" | "created_at">) => {
      const { error } = await supabase.from("transactions").insert({
        ...txn,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setSheetOpen(false);
      toast({ title: "Операция добавлена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  // ─── Update ───────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (txn: Omit<Transaction, "id" | "created_at">) => {
      if (!selected) return;
      const { error } = await supabase
        .from("transactions")
        .update({ ...txn })
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setSelected(null);
      toast({ title: "Операция обновлена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setSelected(null);
      toast({ title: "Операция удалена" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (currencyFilter !== "all" && t.currency !== currencyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.description?.toLowerCase().includes(q) ||
        t.cashflow_category.toLowerCase().includes(q) ||
        t.pnl_category.toLowerCase().includes(q) ||
        t.wallet_account.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Операции</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} записей</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} size="sm" className="bg-income hover:bg-income/90 text-income-foreground h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="income">Доход</SelectItem>
            <SelectItem value="expense">Расход</SelectItem>
            <SelectItem value="transfer">Перевод</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue placeholder="Валюта" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="UZS">UZS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="RUB">RUB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-auto bg-card">
        <table className="w-full erp-table">
          <thead>
            <tr>
              <th className="text-left px-3 py-2">Дата ДДС</th>
              <th className="text-left px-3 py-2">Месяц ОПУ</th>
              <th className="text-left px-3 py-2">Статья / Категория</th>
              <th className="text-left px-3 py-2">Счёт</th>
              <th className="text-right px-3 py-2">Сумма</th>
              <th className="text-left px-3 py-2">Валюта</th>
              <th className="text-left px-3 py-2 min-w-[200px]">Комментарий</th>
              <th className="text-center px-3 py-2">Тип</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Загрузка...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Операции не найдены
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer animate-slide-in"
                  onClick={() => setSelected(t)}
                >
                  <td className="px-3 font-mono text-xs">{t.transaction_date}</td>
                  <td className="px-3 font-mono text-xs">{t.reporting_month}</td>
                  {/* Merged category column: cashflow on top, pnl below */}
                  <td className="px-3">
                    <div className="flex flex-col gap-0.5">
                      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 w-fit">
                        {t.cashflow_category}
                      </Badge>
                      {t.pnl_category && t.pnl_category !== "PEREVOD" && (
                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 w-fit text-muted-foreground">
                          {t.pnl_category}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 text-xs">{t.wallet_account}</td>
                  <td className={`px-3 text-right font-mono text-xs ${t.type === "income" ? "amount-income" : t.type === "expense" ? "amount-expense" : "amount-transfer"}`}>
                    {formatAmountShort(t.amount)}
                  </td>
                  <td className="px-3 text-xs text-muted-foreground">{t.currency}</td>
                  <td className="px-3 text-xs text-muted-foreground truncate max-w-[250px]">{t.description}</td>
                  <td className="px-3 text-center">
                    <Badge className={`text-[10px] border px-1.5 py-0 font-medium ${typeStyles[t.type]}`}>
                      {typeLabels[t.type]}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add sheet */}
      <TransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={(txn) => insertMutation.mutate(txn)}
      />

      {/* Edit/detail sheet */}
      {selected && (
        <TransactionSheet
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
          initial={selected}
          onSubmit={(txn) => updateMutation.mutate(txn)}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}
    </div>
  );
}
