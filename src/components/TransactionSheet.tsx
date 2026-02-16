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
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onSubmit: (txn: Transaction) => void;
}

export function TransactionSheet({ open, onOpenChange, onSubmit }: TransactionSheetProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("UZS");
  const [type, setType] = useState<TransactionType>("expense");
  const [date, setDate] = useState<Date>(new Date());
  const [reportingMonth, setReportingMonth] = useState(format(new Date(), "yyyy-MM"));
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [cashflowCat, setCashflowCat] = useState("");
  const [pnlCat, setPnlCat] = useState("");
  const [description, setDescription] = useState("");

  const cashflowOptions = type === "transfer" ? CASHFLOW_CATEGORIES.transfer : type === "income" ? CASHFLOW_CATEGORIES.income : CASHFLOW_CATEGORIES.expense;
  const pnlOptions = type === "income" ? PNL_CATEGORIES.income : PNL_CATEGORIES.expense;

  const handleSubmit = () => {
    if (!amount || !cashflowCat) return;
    onSubmit({
      id: String(Date.now()),
      created_at: new Date().toISOString(),
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
    // Reset
    setAmount("");
    setDescription("");
    setCashflowCat("");
    setPnlCat("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] bg-card overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Новая операция</SheetTitle>
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

          {/* Row 3: Wallet, Categories */}
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

          <div className="grid grid-cols-2 gap-2">
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

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full h-9 text-xs bg-income hover:bg-income/90 text-income-foreground">
            Сохранить операцию
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
