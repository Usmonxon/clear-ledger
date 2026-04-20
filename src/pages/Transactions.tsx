import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Search, Filter, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { formatAmountShort, type TransactionType } from "@/data/mockData";
import { TransactionSheet, type TransactionFull, type TransactionPayload } from "@/components/TransactionSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTransactionList } from "@/components/MobileTransactionList";
import { MobileTransactionDrawer } from "@/components/MobileTransactionDrawer";

const typeStyles: Record<TransactionType, string> = {
  income: "bg-income-muted text-income border-income/20",
  expense: "bg-expense-muted text-expense border-expense/20",
  transfer: "bg-transfer-muted text-transfer border-transfer/20",
  dividend: "bg-dividend-muted text-dividend border-dividend/20",
};

const typeLabels: Record<TransactionType, string> = {
  income: "ДОХОД",
  expense: "РАСХОД",
  transfer: "ПЕРЕВОД",
  dividend: "ДИВИДЕНДЫ",
};

export default function Transactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories: categoryList } = useCategories();

  const drillCategory = searchParams.get("category");
  const drillMonth = searchParams.get("month");
  const drillBucket = searchParams.get("bucket"); // income | cogs | opex
  const drillCurrency = searchParams.get("currency");
  const hasDrill = !!(drillCategory || drillMonth || drillBucket);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionFull | null>(null);

  useEffect(() => {
    if (drillCurrency) setCurrencyFilter(drillCurrency);
    if (drillBucket === "income") setTypeFilter("income");
    else if (drillBucket === "cogs" || drillBucket === "opex") setTypeFilter("expense");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillCurrency, drillBucket]);

  const cogsNames = useMemo(() => {
    const s = new Set<string>();
    categoryList.filter((c) => c.type === "expense" && c.is_cogs).forEach((c) => s.add(c.name));
    return s;
  }, [categoryList]);

  const clearDrill = () => {
    setSearchParams({});
    setCurrencyFilter("all");
    setTypeFilter("all");
  };

  const drillMonthLabel = (mk: string) => {
    const [y, m] = mk.split("-");
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), "LLLL yyyy", { locale: ru });
  };

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as TransactionFull[];
    },
    enabled: !!user,
  });

  // ─── Insert ───────────────────────────────────────────────────────────────
  const insertMutation = useMutation({
    mutationFn: async (txn: TransactionPayload) => {
      const { error } = await supabase.from("transactions").insert({ ...txn, user_id: user!.id });
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
    mutationFn: async (txn: TransactionPayload) => {
      if (!selected) return;
      const { error } = await supabase.from("transactions").update({ ...txn }).eq("id", selected.id);
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

  // ─── Desktop Filter ──────────────────────────────────────────────────────
  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (currencyFilter !== "all" && t.currency !== currencyFilter) return false;
    if (drillCategory && t.cashflow_category !== drillCategory) return false;
    if (drillMonth && t.reporting_month !== drillMonth) return false;
    if (drillBucket) {
      if (drillBucket === "income" && t.type !== "income") return false;
      if (drillBucket === "cogs" && !(t.type === "expense" && cogsNames.has(t.cashflow_category))) return false;
      if (drillBucket === "opex" && !(t.type === "expense" && !cogsNames.has(t.cashflow_category))) return false;
    }
    if (hasDrill && (t.type === "transfer" || t.type === "dividend")) return false;
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

  const grouped = useMemo(() => {
    const map = new Map<string, TransactionFull[]>();
    filtered.forEach((t) => {
      const key = t.transaction_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Drill banner (shared)
  const DrillBanner = hasDrill ? (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md text-xs">
      <span className="font-medium text-primary">Фильтр из ОПУ:</span>
      <span className="text-foreground flex flex-wrap gap-1.5">
        {drillCategory && <Badge variant="outline" className="text-[10px]">{drillCategory}</Badge>}
        {drillMonth && <Badge variant="outline" className="text-[10px]">{drillMonthLabel(drillMonth)}</Badge>}
        {drillBucket && <Badge variant="outline" className="text-[10px] uppercase">{drillBucket}</Badge>}
        {drillCurrency && <Badge variant="outline" className="text-[10px]">{drillCurrency}</Badge>}
      </span>
      <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto text-xs" onClick={clearDrill}>
        <X className="h-3 w-3 mr-1" /> Сбросить
      </Button>
    </div>
  ) : null;

  // ─── Mobile ───────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {DrillBanner && <div className="p-3 pb-0">{DrillBanner}</div>}
        <MobileTransactionList
          transactions={hasDrill ? filtered : transactions}
          isLoading={isLoading}
          onAdd={() => setSheetOpen(true)}
          onSelect={(t) => setSelected(t)}
        />

        <MobileTransactionDrawer
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSubmit={(txn) => insertMutation.mutate(txn)}
        />

        {selected && (
          <MobileTransactionDrawer
            open={!!selected}
            onOpenChange={(v) => { if (!v) setSelected(null); }}
            initial={selected}
            onSubmit={(txn) => updateMutation.mutate(txn)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        )}
      </>
    );
  }

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

      {DrillBanner}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="income">Доход</SelectItem>
            <SelectItem value="expense">Расход</SelectItem>
            <SelectItem value="transfer">Перевод</SelectItem>
            <SelectItem value="dividend">Дивиденды</SelectItem>
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue placeholder="Валюта" /></SelectTrigger>
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
              <th className="text-left px-3 py-2">Дата</th>
              <th className="text-left px-3 py-2">Категория</th>
              <th className="text-left px-3 py-2">Счёт</th>
              <th className="text-right px-3 py-2">Сумма</th>
              <th className="text-left px-3 py-2">Вал.</th>
              <th className="text-left px-3 py-2 min-w-[180px]">Комментарий</th>
              <th className="text-center px-3 py-2">📎</th>
              <th className="text-left px-3 py-2 whitespace-nowrap">Мес. ОПУ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">Загрузка...</td>
              </tr>
            ) : grouped.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">Операции не найдены</td>
              </tr>
            ) : (
              grouped.map(([dateStr, txns]) => (
                <React.Fragment key={dateStr}>
                  <tr>
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                      {format(parseISO(dateStr), "d MMMM yyyy", { locale: ru })}
                    </td>
                  </tr>
                  {txns.map((t) => (
                    <tr key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                      <td className="px-3 text-xs tabular-nums"></td>
                      <td className="px-3">
                        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{t.cashflow_category}</Badge>
                      </td>
                      <td className="px-3 text-xs">
                        {t.type === "transfer" && t.from_account && t.to_account
                          ? <span className="text-transfer">{t.from_account} → {t.to_account}</span>
                          : t.wallet_account
                        }
                      </td>
                      <td className={`px-3 text-right text-xs tabular-nums ${t.type === "income" ? "amount-income" : t.type === "expense" ? "amount-expense" : t.type === "dividend" ? "amount-dividend" : "amount-transfer"}`}>
                        {formatAmountShort(t.amount)}
                        {t.target_amount != null && t.target_currency && (
                          <span className="block text-[10px] text-muted-foreground">→ {formatAmountShort(t.target_amount)} {t.target_currency}</span>
                        )}
                      </td>
                      <td className="px-3 text-xs text-muted-foreground">{t.currency}</td>
                      <td className="px-3 text-xs text-muted-foreground truncate max-w-[220px]">{t.description}</td>
                      <td className="px-3 text-center">
                        {t.attachment_url && <Paperclip className="h-3 w-3 text-muted-foreground mx-auto" />}
                      </td>
                      <td className="px-3 text-xs tabular-nums text-muted-foreground">{t.reporting_month}</td>
                    </tr>
                  ))}
                </React.Fragment>
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
