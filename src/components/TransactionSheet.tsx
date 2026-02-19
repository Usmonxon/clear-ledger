import { useState } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  WALLETS,
  CASHFLOW_CATEGORIES,
  PNL_CATEGORIES,
  type Transaction,
  type TransactionType,
  type Currency,
} from "@/data/mockData";

interface TransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (txn: Omit<Transaction, "id" | "created_at">) => void;
  onDelete?: (id: string) => void;
  initial?: Transaction | null;
}

export function TransactionSheet({ open, onOpenChange, onSubmit, onDelete, initial }: TransactionSheetProps) {
  const isEdit = !!initial;

  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "UZS");
  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [date, setDate] = useState<Date>(initial ? new Date(initial.transaction_date) : new Date());
  const [reportingMonth, setReportingMonth] = useState(initial?.reporting_month ?? format(new Date(), "yyyy-MM"));
  const [wallet, setWallet] = useState(initial?.wallet_account ?? WALLETS[0]);
  const [cashflowCat, setCashflowCat] = useState(initial?.cashflow_category ?? "");
  const [pnlCat, setPnlCat] = useState(initial?.pnl_category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  // Reset when initial changes
  const resetToInitial = () => {
    if (initial) {
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setType(initial.type);
      setDate(new Date(initial.transaction_date));
      setReportingMonth(initial.reporting_month);
      setWallet(initial.wallet_account);
      setCashflowCat(initial.cashflow_category);
      setPnlCat(initial.pnl_category);
      setDescription(initial.description ?? "");
    } else {
      setAmount("");
      setCurrency("UZS");
      setType("expense");
      setDate(new Date());
      setReportingMonth(format(new Date(), "yyyy-MM"));
      setWallet(WALLETS[0]);
      setCashflowCat("");
      setPnlCat("");
      setDescription("");
    }
  };

  const cashflowOptions = type === "transfer" ? CASHFLOW_CATEGORIES.transfer : type === "income" ? CASHFLOW_CATEGORIES.income : CASHFLOW_CATEGORIES.expense;
  const pnlOptions = type === "income" ? PNL_CATEGORIES.income : PNL_CATEGORIES.expense;

  const handleSubmit = () => {
    if (!amount || !cashflowCat) return;
    onSubmit({
      transaction_date: format(date, "yyyy-MM-dd"),
      reporting_month: reportingMonth,
      amount: parseFloat(amount),
      currency,
      wallet_account: wallet,
      cashflow_category: cashflowCat,
      pnl_category: type === "transfer" ? "PEREVOD" : pnlCat,
      description,
      type,
    });
    if (!isEdit) {
      setAmount("");
      setDescription("");
      setCashflowCat("");
      setPnlCat("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetToInitial(); onOpenChange(v); }}>
      <SheetContent className="w-[420px] sm:w-[480px] bg-card overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pr-6">
          <SheetTitle className="text-base">
            {isEdit ? "Операция" : "Новая операция"}
          </SheetTitle>
          {isEdit && onDelete && initial && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить операцию?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие необратимо. Операция будет удалена из базы данных.
                  </AlertDialogDescription>
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
          {/* Row 1: Amount, Currency, Type */}
          <div className="grid grid-cols-[1fr_80px_100px] gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Сумма</Label>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Валюта</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="UZS">UZS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="RUB">RUB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Тип</Label>
              <Select value={type} onValueChange={(v) => setType(v as TransactionType)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Date, PnL Month */}
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
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Месяц ОПУ</Label>
              <Input
                type="month"
                value={reportingMonth}
                onChange={(e) => setReportingMonth(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Wallet */}
          <div>
            <Label className="text-xs text-muted-foreground">Счёт (Кошелёк)</Label>
            <Select value={wallet} onValueChange={setWallet}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {WALLETS.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categories — stacked in one column (matches table merge) */}
          <div>
            <Label className="text-xs text-muted-foreground">Статья ДДС</Label>
            <Select value={cashflowCat} onValueChange={setCashflowCat}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Выберите..." />
              </SelectTrigger>
              <SelectContent className="bg-popover max-h-[200px]">
                {cashflowOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type !== "transfer" && (
            <div>
              <Label className="text-xs text-muted-foreground">Категория ОПУ</Label>
              <Select value={pnlCat} onValueChange={setPnlCat}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Выберите..." />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[200px]">
                  {pnlOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full h-9 text-xs bg-income hover:bg-income/90 text-income-foreground">
            {isEdit ? "Сохранить изменения" : "Сохранить операцию"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
