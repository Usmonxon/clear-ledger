export type TransactionType = "income" | "expense" | "transfer";
export type Currency = "UZS" | "USD" | "RUB";

export interface Transaction {
  id: string;
  created_at: string;
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
}

export const WALLETS = [
  "Karta UM",
  "Naqd UM",
  "Naqd SKV",
  "Bank akkaunt",
  "Dollar",
];

export const CASHFLOW_CATEGORIES = {
  income: [
    "CRM",
    "amoCRM интеграция",
    "amoCRM подписка",
    "Битрикс24 интеграция",
    "Битрикс24 подписка",
    "Operatsion",
    "Boshqa",
  ],
  expense: [
    "operatsion.oylik",
    "operatsion.yo'lkira",
    "operatsion.ofis",
    "operatsion.boshqa",
    "dasturlar.amoCRM",
    "dasturlar.Bitrix24",
    "dasturlar.iSpring",
    "sherikchilik",
    "kommissiya.bank",
    "kommissiya.plastik",
    "kommissiya.dollar",
    "kurs",
    "arenda",
  ],
  transfer: ["PEREVOD"],
};

export const PNL_CATEGORIES = {
  income: [
    "CRM",
    "amoCRM интеграция",
    "amoCRM подписка",
    "Битрикс24 интеграция",
    "Битрикс24 подписка",
    "Task manager",
    "LMS",
    "Operatsion",
  ],
  expense: [
    "operatsion",
    "oylik",
    "yo'lkira",
    "ofis xarajatlari",
    "arenda",
    "boshqa",
    "sherikchilik",
    "kommissiya",
    "dasturlar",
    "amoCRM",
    "Bitrix24",
    "iSpring",
    "kurs",
    "rivojlanish",
    "soliq",
  ],
};

export const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const MONTH_KEYS = [
  "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
  "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
];

function rnd(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) / 1000) * 1000;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  let id = 1;

  const incomeDescs = [
    "amoCRMdan keshbek",
    "Telefonni sotvordik. Qimizga",
    "G'olibjon aka predoplata qildilar",
    "Sunhitech uchun 7 kishiga tolovi",
    "SunHiTech uchun amocrmga tolov",
    "Xayrulla aka nanolitda profil qo'shish uchun to'lov",
    "Uktam aka City Motrid amoCRM to'lov",
    "Olim aka hostmaster uchun to'lov",
    "5250000 tolashlari kk",
  ];

  const expenseDescs = [
    "IP telefoniya uchun outsoursga",
    "Nanolit amocrm uchun to'lov",
    "Nursaidga avans",
    "Asadbek aka avans",
    "Hostmasterga Chemion uchun to'lov",
    "automaster.uz ga sergeli",
    "Keles Abdulloh aka tosh ish chiqarish",
    "Salesdoctor akkaunti uchun tolov",
    "targetdan qarz bor edi, shuni to'lov qildik",
  ];

  // Generate ~80 transactions across May-August 2024
  for (let month = 5; month <= 8; month++) {
    const txCount = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < txCount; i++) {
      const type: TransactionType = Math.random() < 0.35 ? "income" : Math.random() < 0.85 ? "expense" : "transfer";
      const day = 1 + Math.floor(Math.random() * 28);
      const dateStr = `2024-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // reporting_month might differ from transaction month
      const reportMonth = Math.random() < 0.15 ? month - 1 : month;
      const reportMonthStr = `2024-${String(Math.max(1, reportMonth)).padStart(2, "0")}`;

      const cats = type === "income" ? CASHFLOW_CATEGORIES.income : type === "expense" ? CASHFLOW_CATEGORIES.expense : CASHFLOW_CATEGORIES.transfer;
      const pnlCats = type === "income" ? PNL_CATEGORIES.income : PNL_CATEGORIES.expense;

      txns.push({
        id: String(id++),
        created_at: new Date().toISOString(),
        transaction_date: dateStr,
        reporting_month: reportMonthStr,
        amount: type === "income" ? rnd(500000, 15000000) : type === "expense" ? rnd(40000, 5000000) : rnd(500000, 3000000),
        currency: Math.random() < 0.8 ? "UZS" : Math.random() < 0.5 ? "USD" : "RUB",
        wallet_account: pickRandom(WALLETS),
        cashflow_category: pickRandom(cats),
        pnl_category: type === "transfer" ? "PEREVOD" : pickRandom(pnlCats),
        description: type === "income" ? pickRandom(incomeDescs) : type === "expense" ? pickRandom(expenseDescs) : "",
        type,
      });
    }
  }

  return txns.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
}

export const mockTransactions = generateMockTransactions();

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === "USD") return `$${amount.toLocaleString("ru-RU")}`;
  if (currency === "RUB") return `₽${amount.toLocaleString("ru-RU")}`;
  return `${amount.toLocaleString("ru-RU")} сум`;
}

export function formatAmountShort(amount: number): string {
  return amount.toLocaleString("ru-RU");
}
