import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Check, X, Mail, Shield, ShieldOff, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { TelegramTab } from "@/components/TelegramTab";
import { format } from "date-fns";

type Member = {
  id: string;
  owner_id: string;
  member_email: string;
  member_id: string | null;
  access_type: "full" | "limited";
  status: "pending" | "active";
  invited_at: string;
};

function CategorySection({ type, label }: { type: "income" | "expense" | "transfer"; label: string }) {
  const { categories, addMutation, deleteMutation, toggleCogsMutation, seedDefaults, isLoading } = useCategories();
  const [newName, setNewName] = useState("");

  useEffect(() => { seedDefaults(); }, []);

  const filtered = categories.filter((c) => c.type === type);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addMutation.mutate({ name: trimmed, type });
    setNewName("");
  };

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {type === "expense" && (
        <p className="text-[10px] text-muted-foreground mb-2">
          💡 Нажмите на иконку 💲 чтобы пометить категорию как себестоимость (COGS). Себестоимость вычитается из выручки в отчёте ОПУ.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Загрузка...</span>
        ) : filtered.length === 0 ? (
          <span className="text-xs text-muted-foreground">Нет категорий</span>
        ) : (
          filtered.map((c) => (
            <Badge
              key={c.id}
              variant="outline"
              className={`text-[10px] pr-0.5 gap-1 ${
                c.is_cogs ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" :
                type === "income" ? "bg-income-muted text-income border-income/20" :
                type === "expense" ? "bg-expense-muted text-expense border-expense/20" :
                "bg-transfer-muted text-transfer border-transfer/20"
              }`}
            >
              {type === "expense" && (
                <button
                  onClick={() => toggleCogsMutation.mutate({ id: c.id, is_cogs: !c.is_cogs })}
                  className={`hover:opacity-70 transition-opacity ${c.is_cogs ? "opacity-100" : "opacity-40"}`}
                  title={c.is_cogs ? "Убрать из себестоимости" : "Пометить как себестоимость"}
                >
                  💲
                </button>
              )}
              {c.name}
              <ConfirmDelete
                onConfirm={() => deleteMutation.mutate(c.id)}
                title="Удалить категорию?"
                description={`Категория «${c.name}» будет удалена. Это не повлияет на существующие операции.`}
                variant="badge"
              />
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Новая категория..."
          className="h-7 text-xs"
        />
        <Button onClick={handleAdd} size="sm" variant="outline" className="h-7 px-2" disabled={addMutation.isPending}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function AccountRow({ account, onSave, onDelete }: {
  account: { id: string; name: string; currency: string; initial_balance: number };
  onSave: (id: string, name: string, currency: string, initial_balance: number) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState(account.currency);
  const [balance, setBalance] = useState(String(account.initial_balance));

  const handleSave = () => {
    onSave(account.id, name, currency, parseFloat(balance) || 0);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{account.name}</span>
          <Badge variant="outline" className="text-[10px]">{account.currency}</Badge>
          <span className="text-xs text-muted-foreground font-mono">
            нач: {Number(account.initial_balance).toLocaleString("ru-RU")}
          </span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <ConfirmDelete
            onConfirm={() => onDelete(account.id)}
            title="Удалить счёт?"
            description={`Счёт «${account.name}» будет удалён. Операции по этому счёту сохранятся.`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs flex-1" placeholder="Название" />
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="UZS">UZS</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="RUB">RUB</SelectItem>
        </SelectContent>
      </Select>
      <Input value={balance} onChange={(e) => setBalance(e.target.value)} className="h-7 text-xs w-[120px] font-mono" placeholder="Нач. баланс" type="number" />
      <Button variant="ghost" size="icon" className="h-6 w-6 text-income" onClick={handleSave}><Check className="h-3 w-3" /></Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
    </div>
  );
}

function AccountsTab() {
  const { accounts, addMutation, updateMutation, deleteMutation, seedDefaults, isLoading } = useAccounts();
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("UZS");
  const [newBalance, setNewBalance] = useState("");

  useEffect(() => { seedDefaults(); }, []);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addMutation.mutate({ name: trimmed, currency: newCurrency, initial_balance: parseFloat(newBalance) || 0 });
    setNewName("");
    setNewBalance("");
  };

  return (
    <div className="space-y-3">
      <div className="border rounded-md bg-card p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Загрузка...</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Нет счетов</p>
        ) : (
          accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              onSave={(id, name, currency, initial_balance) => updateMutation.mutate({ id, name, currency, initial_balance })}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Название счёта"
          className="h-8 text-xs flex-1 min-w-[140px]"
        />
        <Select value={newCurrency} onValueChange={setNewCurrency}>
          <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="UZS">UZS</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="RUB">RUB</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          placeholder="Нач. баланс"
          className="h-8 text-xs w-[130px] font-mono"
          type="number"
        />
        <Button onClick={handleAdd} size="sm" className="h-8 text-xs" disabled={addMutation.isPending}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить
        </Button>
      </div>
    </div>
  );
}

function ExchangeRatesTab() {
  const { rates, isLoading, addMutation, deleteMutation } = useExchangeRates();
  const [effectiveDate, setEffectiveDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("UZS");
  const [rateValue, setRateValue] = useState("");

  const handleAdd = () => {
    const val = parseFloat(rateValue);
    if (!val || fromCurrency === toCurrency) return;
    addMutation.mutate({ effective_date: effectiveDate, from_currency: fromCurrency, to_currency: toCurrency, rate: val });
    setRateValue("");
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <p>Укажите курсы валют с точной датой. Курс действует для всех операций от этой даты до следующего обновления.</p>
        <p className="mt-1">Пример: с 01.01.2025 → 1 USD = 12 800 UZS (действует пока не появится новый курс)</p>
      </div>

      {/* Add new rate */}
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label className="text-[10px] text-muted-foreground">Дата</label>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-8 text-xs w-[150px]" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Из</label>
          <Select value={fromCurrency} onValueChange={setFromCurrency}>
            <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="RUB">RUB</SelectItem>
              <SelectItem value="UZS">UZS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">В</label>
          <Select value={toCurrency} onValueChange={setToCurrency}>
            <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="UZS">UZS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="RUB">RUB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Курс</label>
          <Input
            type="number"
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            placeholder="12800"
            className="h-8 text-xs w-[120px] font-mono"
          />
        </div>
        <Button onClick={handleAdd} size="sm" className="h-8 text-xs" disabled={addMutation.isPending}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Добавить
        </Button>
      </div>

      {/* Rates list */}
      <div className="border rounded-md bg-card">
        {isLoading ? (
          <p className="p-4 text-xs text-muted-foreground">Загрузка...</p>
        ) : rates.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground text-center">Нет курсов. Добавьте курс выше.</p>
        ) : (
          <div className="divide-y divide-border">
            {rates.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px] font-mono">{formatDate(r.effective_date)}</Badge>
                  <span className="text-xs">
                    1 {r.from_currency} = <span className="font-mono font-semibold">{Number(r.rate).toLocaleString("ru-RU")}</span> {r.to_currency}
                  </span>
                </div>
                <ConfirmDelete
                  onConfirm={() => deleteMutation.mutate(r.id)}
                  title="Удалить курс?"
                  description={`Курс ${r.from_currency}→${r.to_currency} от ${formatDate(r.effective_date)} будет удалён.`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AccessTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [accessType, setAccessType] = useState<"full" | "limited">("limited");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace_members", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("owner_id", user!.id)
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
    enabled: !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ member_email, access_type }: { member_email: string; access_type: "full" | "limited" }) => {
      const { error } = await supabase.from("workspace_members").insert({
        owner_id: user!.id,
        member_email,
        access_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace_members"] });
      toast({ title: "Приглашение отправлено", description: "Пользователь получит доступ после входа в систему" });
      setEmail("");
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ id, access_type }: { id: string; access_type: "full" | "limited" }) => {
      const { error } = await supabase.from("workspace_members").update({ access_type }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace_members"] });
      toast({ title: "Доступ обновлён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace_members"] });
      toast({ title: "Доступ отозван" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const handleInvite = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast({ title: "Введите корректный email", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({ member_email: trimmed, access_type: accessType });
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Типы доступа:</p>
        <p><span className="text-income font-medium">Полный доступ</span> — может добавлять, редактировать и удалять операции.</p>
        <p><span className="text-transfer font-medium">Ограниченный</span> — может добавлять и редактировать, но не удалять.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          placeholder="Email пользователя"
          className="h-8 text-xs flex-1 min-w-[200px]"
          type="email"
        />
        <Select value={accessType} onValueChange={(v) => setAccessType(v as "full" | "limited")}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="full">Полный доступ</SelectItem>
            <SelectItem value="limited">Ограниченный</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleInvite} size="sm" className="h-8 text-xs" disabled={inviteMutation.isPending}>
          <Mail className="h-3.5 w-3.5 mr-1" />
          Пригласить
        </Button>
      </div>

      <div className="border rounded-md bg-card">
        {isLoading ? (
          <p className="p-4 text-xs text-muted-foreground">Загрузка...</p>
        ) : members.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground text-center">Нет участников</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {m.member_email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium">{m.member_email}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {m.status === "pending" ? "Ожидает входа" : "Активен"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-[10px] cursor-pointer ${
                    m.access_type === "full"
                      ? "bg-income-muted text-income border-income/20"
                      : "bg-transfer-muted text-transfer border-transfer/20"
                  }`}
                  variant="outline"
                  onClick={() => updateAccessMutation.mutate({ id: m.id, access_type: m.access_type === "full" ? "limited" : "full" })}
                >
                  {m.access_type === "full"
                    ? <><Shield className="h-2.5 w-2.5 mr-0.5 inline" />Полный</>
                    : <><ShieldOff className="h-2.5 w-2.5 mr-0.5 inline" />Ограниченный</>
                  }
                </Badge>
                <ConfirmDelete
                  onConfirm={() => revokeMutation.mutate(m.id)}
                  title="Отозвать доступ?"
                  description={`Пользователь ${m.member_email} потеряет доступ к вашим данным.`}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
function ProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setCompanyName(profile.company_name || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async ({ display_name, company_name }: { display_name: string; company_name: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name, company_name, updated_at: new Date().toISOString() })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Профиль обновлён" });
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    updateMutation.mutate({ display_name: displayName.trim(), company_name: companyName.trim() });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Загрузка...</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Email</label>
          <Input value={user?.email || ""} disabled className="h-8 text-xs bg-muted" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ваше имя"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Компания</label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Название компании"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <Button onClick={handleSave} size="sm" className="h-8 text-xs" disabled={updateMutation.isPending}>
        <Check className="h-3.5 w-3.5 mr-1" />
        Сохранить
      </Button>
    </div>
  );
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-muted-foreground">Тема оформления</p>
      <Select value={theme || "system"} onValueChange={setTheme}>
        <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" /> Светлая</span></SelectItem>
          <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" /> Тёмная</span></SelectItem>
          <SelectItem value="system"><span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Системная</span></SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">Настройки</h1>
        <p className="text-xs text-muted-foreground">Профиль, справочники, счета и управление доступом</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="h-8">
          <TabsTrigger value="profile" className="text-xs h-7">Профиль</TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs h-7">Счета</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs h-7">Категории</TabsTrigger>
          <TabsTrigger value="rates" className="text-xs h-7">Курсы валют</TabsTrigger>
          <TabsTrigger value="access" className="text-xs h-7">Доступ</TabsTrigger>
          <TabsTrigger value="telegram" className="text-xs h-7">Telegram</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Профиль</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ProfileTab />
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Внешний вид</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ThemeSelector />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Счета (Кошельки)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <AccountsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4 space-y-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Категории доходов</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <CategorySection type="income" label="Доходы" />
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Категории расходов</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <CategorySection type="expense" label="Расходы" />
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Переводы</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <CategorySection type="transfer" label="Переводы" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Курсы валют</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ExchangeRatesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Совместный доступ</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <AccessTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram" className="mt-4">
          <Card className="border">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">Telegram бот</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <TelegramTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
