import { useState, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2, Wallet, Tag, FileText, ImageIcon, X, Paperclip, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWithSeparators, stripNonNumeric } from "@/lib/formatNumber";
import { parseAttachmentUrls, serializeAttachmentUrls, isImageUrl } from "@/lib/attachments";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { formatAmountShort, type TransactionType, type Currency } from "@/data/mockData";
import type { TransactionFull, TransactionPayload } from "@/components/TransactionSheet";

const typeOptions: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Расход" },
  { value: "income", label: "Доход" },
  { value: "transfer", label: "Перевод" },
  { value: "dividend", label: "Дивиденды" },
];

const typeColor: Record<TransactionType, string> = {
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
  dividend: "text-dividend",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (txn: TransactionPayload) => void;
  onDelete?: (id: string) => void;
  initial?: TransactionFull | null;
}

export function MobileTransactionDrawer({ open, onOpenChange, onSubmit, onDelete, initial }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = !!initial;

  const { getCategoryNames, isLoading: catsLoading } = useCategories();
  const { accounts, accountNames, isLoading: accsLoading } = useAccounts();

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "UZS");
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

  const categoryOptions = getCategoryNames(type);
  const defaultWallet = accountNames[0] ?? "";

  const fromAccountCurrency = useMemo(() => {
    if (type !== "transfer" || !fromAccount) return null;
    return accounts.find((a) => a.name === fromAccount)?.currency ?? null;
  }, [type, fromAccount, accounts]);

  const toAccountCurrency = useMemo(() => {
    if (type !== "transfer" || !toAccount) return null;
    return accounts.find((a) => a.name === toAccount)?.currency ?? null;
  }, [type, toAccount, accounts]);

  const isCrossCurrency = type === "transfer" && fromAccountCurrency && toAccountCurrency && fromAccountCurrency !== toAccountCurrency;

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

  return (
    <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
      <DrawerContent className="max-h-[92vh] flex flex-col">
        <DrawerTitle className="sr-only">{isEdit ? "Редактировать операцию" : "Новая операция"}</DrawerTitle>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
          {/* Type tabs */}
          <div className="flex rounded-xl bg-muted p-1 mt-2">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setType(opt.value); setCategory(""); setFromAccount(""); setToAccount(""); setTargetAmount(""); }}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                  type === opt.value
                    ? "bg-card shadow-sm " + typeColor[opt.value]
                    : "text-muted-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Amount display */}
          <div className="text-center py-4">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatWithSeparators(amount)}
              onChange={(e) => setAmount(stripNonNumeric(e.target.value))}
              className={cn(
                "text-center text-4xl font-mono font-bold border-0 bg-transparent h-auto focus-visible:ring-0",
                typeColor[type]
              )}
            />
            <div className="flex items-center justify-center gap-2 mt-2">
              {type !== "transfer" ? (
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger className="h-8 w-20 text-xs rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                  </SelectContent>
                </Select>
              ) : fromAccountCurrency ? (
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{fromAccountCurrency}</span>
              ) : null}
            </div>
          </div>

          {/* Cross-currency target amount */}
          {isCrossCurrency && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Сумма зачисления ({toAccountCurrency})</p>
              <Input
                 type="text"
                 inputMode="decimal"
                 placeholder="0"
                 value={formatWithSeparators(targetAmount)}
                 onChange={(e) => setTargetAmount(stripNonNumeric(e.target.value))}
                className="text-center text-2xl font-mono font-bold border-0 bg-transparent h-auto focus-visible:ring-0 text-transfer"
              />
            </div>
          )}

          {/* Form fields as rows */}
          <div className="space-y-1 bg-muted/50 rounded-xl overflow-hidden">
            {/* Account */}
            {type === "transfer" ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 bg-card">
                  <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground">Со счёта</p>
                    <Select value={fromAccount || defaultWallet} onValueChange={setFromAccount}>
                      <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0"><SelectValue placeholder="Откуда" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 bg-card">
                  <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground">На счёт</p>
                    <Select value={toAccount} onValueChange={setToAccount}>
                      <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0"><SelectValue placeholder="Куда" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.filter((w) => w !== fromAccount).map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-card">
                <Wallet className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">Счёт</p>
                  <Select value={wallet || defaultWallet} onValueChange={setWallet}>
                    <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {accsLoading ? <SelectItem value="...">Загрузка...</SelectItem> : accountNames.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Category */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card">
              <Tag className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">Категория</p>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0"><SelectValue placeholder="Выберите..." /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-[220px]">
                    {catsLoading ? (
                      <SelectItem value="...">Загрузка...</SelectItem>
                    ) : categoryOptions.length === 0 ? (
                      <SelectItem value="__none__" disabled>Нет категорий</SelectItem>
                    ) : (
                      categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card">
              <CalendarIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">Дата</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-sm font-medium text-left">
                      {format(date, "dd.MM.yyyy")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Мес. ОПУ</p>
                <Input type="month" value={reportingMonth} onChange={(e) => setReportingMonth(e.target.value)} className="h-7 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 w-28" />
              </div>
            </div>

            {/* Note */}
            <div className="flex items-start gap-3 px-4 py-3 bg-card">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">Комментарий</p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание..."
                  className="min-h-[40px] text-sm border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 resize-none"
                />
              </div>
            </div>

            {/* Attachments */}
            <div className="px-4 py-3 bg-card space-y-2">
              <div className="flex items-center gap-3">
                <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  {attachmentUrls.length === 0 ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-sm text-muted-foreground"
                    >
                      {uploading ? "Загрузка..." : "Прикрепить фото"}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{attachmentUrls.length} файл(ов)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Ещё
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {attachmentUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 ml-8">
                  {attachmentUrls.map((url, i) => (
                    <div key={i} className="relative rounded-md overflow-hidden border border-border group">
                      {isImageUrl(url) ? (
                        <img src={url} alt={`Файл ${i + 1}`} className="w-full h-14 object-cover bg-muted" />
                      ) : (
                        <div className="flex items-center justify-center bg-muted h-14">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-5 w-5 bg-background/80 hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={handleSubmit} className="w-full h-12 text-sm font-medium rounded-xl bg-income hover:bg-income/90 text-income-foreground">
              {isEdit ? "Сохранить" : "Добавить"}
            </Button>

            {isEdit && onDelete && initial && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full h-10 text-sm text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
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
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
