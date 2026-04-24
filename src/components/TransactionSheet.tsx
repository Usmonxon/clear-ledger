import { useState, useRef, useMemo } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2, Paperclip, X, ImageIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWithSeparators, stripNonNumeric } from "@/lib/formatNumber";
import { parseAttachmentUrls, serializeAttachmentUrls, isImageUrl } from "@/lib/attachments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { type TransactionType, type Currency, formatAmountShort } from "@/data/mockData";

export type TransactionPayload = {
  transaction_date: string;
  reporting_month: string;
  amount: number;
  currency: Currency;
  wallet_account: string;
  cashflow_category: string;
  pnl_category: string;
  description: string;
  type: TransactionType;
  from_account?: string | null;
  to_account?: string | null;
  attachment_url?: string | null;
  target_currency?: string | null;
  target_amount?: number | null;
};

export type TransactionFull = TransactionPayload & {
  id: string;
  created_at: string;
};

interface TransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (txn: TransactionPayload) => void;
  onDelete?: (id: string) => void;
  initial?: TransactionFull | null;
  canDelete?: boolean;
}

export function TransactionSheet({ open, onOpenChange, onSubmit, onDelete, initial, canDelete = true }: TransactionSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = !!initial;

  const { getCategoryNames, isLoading: catsLoading } = useCategories();
  const { accounts, accountNames, isLoading: accsLoading } = useAccounts();
  const { getBalance } = useAccountBalances(initial?.id);

  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "UZS");
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [date, setDate] = useState<Date>(initial ? new Date(initial.transaction_date) : new Date());
  const [reportingMonth, setReportingMonth] = useState(initial?.reporting_month ?? format(new Date(), "yyyy-MM"));
  const [wallet, setWallet] = useState(initial?.wallet_account ?? "");
  const [fromAccount, setFromAccount] = useState(initial?.from_account ?? "");
  const [toAccount, setToAccount] = useState(initial?.to_account ?? "");
  const [category, setCategory] = useState(initial?.cashflow_category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(parseAttachmentUrls(initial?.attachment_url));
  const [uploading, setUploading] = useState(false);
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount ? String(initial.target_amount) : "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetToInitial = () => {
    if (initial) {
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setType(initial.type);
      setDate(new Date(initial.transaction_date));
      setReportingMonth(initial.reporting_month);
      setWallet(initial.wallet_account);
      setFromAccount(initial.from_account ?? "");
      setToAccount(initial.to_account ?? "");
      setCategory(initial.cashflow_category);
      setDescription(initial.description ?? "");
      setAttachmentUrls(parseAttachmentUrls(initial.attachment_url));
      setTargetAmount(initial.target_amount ? String(initial.target_amount) : "");
    } else {
      setAmount(""); setCurrency("UZS"); setType("expense");
      setDate(new Date()); setReportingMonth(format(new Date(), "yyyy-MM"));
      setWallet(""); setFromAccount(""); setToAccount("");
      setCategory(""); setDescription(""); setAttachmentUrls([]);
      setTargetAmount("");
    }
  };

  const categoryOptions = getCategoryNames(type);

  const fromAccountCurrency = useMemo(() => {
    if (type !== "transfer" || !fromAccount) return null;
    return accounts.find((a) => a.name === fromAccount)?.currency ?? null;
  }, [type, fromAccount, accounts]);

  const toAccountCurrency = useMemo(() => {
    if (type !== "transfer" || !toAccount) return null;
    return accounts.find((a) => a.name === toAccount)?.currency ?? null;
  }, [type, toAccount, accounts]);

  const isCrossCurrency = type === "transfer" && fromAccountCurrency && toAccountCurrency && fromAccountCurrency !== toAccountCurrency;

  const activeSourceAccount = type === "transfer" ? (fromAccount || accountNames[0] || "") : (wallet || accountNames[0] || "");
  const activeBalance = activeSourceAccount ? getBalance(activeSourceAccount) : null;
  const isOutgoing = type === "expense" || type === "dividend" || type === "transfer";
  const parsedAmount = parseFloat(amount || "0") || 0;
  const exceedsBalance = isOutgoing && activeBalance != null && parsedAmount > activeBalance.current;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("attachments").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("attachments").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      setAttachmentUrls((prev) => [...prev, ...newUrls]);
      toast({ title: `${newUrls.length > 1 ? "Файлы загружены" : "Файл загружен"}` });
    } catch (e: unknown) {
      toast({ title: "Ошибка загрузки", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!amount || (!category && type !== "dividend")) return;
    if (type === "transfer" && (!fromAccount || !toAccount)) {
      toast({ title: "Укажите счета перевода", variant: "destructive" });
      return;
    }
    if (isCrossCurrency && !targetAmount) {
      toast({ title: "Укажите сумму зачисления", variant: "destructive" });
      return;
    }
    if (exceedsBalance) {
      toast({ title: "Недостаточно средств на счёте", description: `Доступно: ${formatAmountShort(activeBalance!.current)} ${activeBalance!.currency}`, variant: "destructive" });
      return;
    }

    const effectiveCurrency = type === "transfer" && fromAccountCurrency ? fromAccountCurrency as Currency : currency;

    onSubmit({
      transaction_date: format(date, "yyyy-MM-dd"),
      reporting_month: reportingMonth,
      amount: parseFloat(amount),
      currency: effectiveCurrency,
      wallet_account: type === "transfer" ? fromAccount : wallet,
      cashflow_category: category || (type === "dividend" ? "Дивиденды" : ""),
      pnl_category: category || (type === "dividend" ? "Дивиденды" : ""),
      description,
      type,
      from_account: type === "transfer" ? fromAccount : null,
      to_account: type === "transfer" ? toAccount : null,
      attachment_url: serializeAttachmentUrls(attachmentUrls),
      target_currency: isCrossCurrency ? toAccountCurrency as string : null,
      target_amount: isCrossCurrency ? parseFloat(targetAmount) : null,
    });
    if (!isEdit) {
      setAmount(""); setDescription(""); setCategory(""); setAttachmentUrls([]); setTargetAmount("");
    }
  };

  const defaultWallet = accountNames[0] ?? "";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetToInitial(); onOpenChange(v); }}>
      <SheetContent className="w-[420px] sm:w-[480px] bg-card overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pr-6">
          <SheetTitle className="text-base">
            {isEdit ? "Операция" : "Новая операция"}
          </SheetTitle>
          {isEdit && onDelete && initial && canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить операцию?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие необратимо.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { onDelete(initial.id); onOpenChange(false); }}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Type selector */}
          <div>
            <Label className="text-xs text-muted-foreground">Тип</Label>
            <Select value={type} onValueChange={(v) => { setType(v as TransactionType); setCategory(""); setFromAccount(""); setToAccount(""); setTargetAmount(""); }}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="income">Доход</SelectItem>
                <SelectItem value="expense">Расход</SelectItem>
                <SelectItem value="transfer">Перевод</SelectItem>
                <SelectItem value="dividend">Дивиденды</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account(s) */}
          {type === "transfer" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Со счёта</Label>
                <Select value={fromAccount || defaultWallet} onValueChange={setFromAccount}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Откуда" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fromAccountCurrency && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Валюта: {fromAccountCurrency}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">На счёт</Label>
                <Select value={toAccount} onValueChange={setToAccount}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Куда" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.filter((w) => w !== fromAccount).map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                {toAccountCurrency && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Валюта: {toAccountCurrency}</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground">Счёт (Кошелёк)</Label>
              <Select value={wallet || defaultWallet} onValueChange={setWallet}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount fields */}
          {isCrossCurrency ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Сумма списания ({fromAccountCurrency})</Label>
                <Input type="text" inputMode="decimal" placeholder="0" value={formatWithSeparators(amount)} onChange={(e) => setAmount(stripNonNumeric(e.target.value))} className="h-9 font-mono" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Сумма зачисления ({toAccountCurrency})</Label>
                <Input type="text" inputMode="decimal" placeholder="0" value={formatWithSeparators(targetAmount)} onChange={(e) => setTargetAmount(stripNonNumeric(e.target.value))} className="h-9 font-mono" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Сумма</Label>
                <Input type="text" inputMode="decimal" placeholder="0" value={formatWithSeparators(amount)} onChange={(e) => setAmount(stripNonNumeric(e.target.value))} className="h-9 font-mono" />
              </div>
              {type !== "transfer" ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Валюта</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="UZS">UZS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="RUB">RUB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-muted-foreground">Валюта</Label>
                  <div className="h-9 flex items-center text-xs text-muted-foreground px-2 border rounded-md bg-muted">
                    {fromAccountCurrency || "—"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date + Reporting month */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Дата ДДС</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 justify-start text-left text-xs font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {date ? format(date, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Месяц ОПУ</Label>
              <Input type="month" value={reportingMonth} onChange={(e) => setReportingMonth(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs text-muted-foreground">Категория</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Выберите..." />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-[220px]">
                {catsLoading ? (
                  <SelectItem value="...">Загрузка...</SelectItem>
                ) : categoryOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>Нет категорий — добавьте в настройках</SelectItem>
                ) : (
                  categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground">Комментарий</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание операции..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-xs text-muted-foreground">Фото / чеки</Label>
            {attachmentUrls.length > 0 && (
              <div className="mt-1 grid grid-cols-3 gap-2">
                {attachmentUrls.map((url, i) => (
                  <div key={i} className="relative rounded-md overflow-hidden border border-border group">
                    {isImageUrl(url) ? (
                      <img src={url} alt={`Файл ${i + 1}`} className="w-full h-20 object-cover bg-muted" />
                    ) : (
                      <div className="flex items-center gap-1.5 p-2 bg-muted h-20">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-transfer underline truncate">
                          Файл {i + 1}
                        </a>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 bg-background/80 hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAttachment(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full h-9 text-xs mt-1 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                "Загрузка..."
              ) : (
                <>
                  {attachmentUrls.length > 0 ? <Plus className="h-3.5 w-3.5 mr-1.5" /> : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                  {attachmentUrls.length > 0 ? "Добавить ещё" : "Прикрепить фото или файл"}
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full h-9 text-xs bg-income hover:bg-income/90 text-income-foreground">
            {isEdit ? "Сохранить изменения" : "Сохранить операцию"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
