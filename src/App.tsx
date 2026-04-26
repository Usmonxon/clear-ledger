import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import Accounts from "./pages/Accounts";
import CashflowReport from "./pages/CashflowReport";
import PnLReport from "./pages/PnLReport";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { useAuth } from "@/hooks/useAuth";
import { useTelegramWebApp } from "@/hooks/useTelegramWebApp";
import { useTelegramAutoLogin } from "@/hooks/useTelegramAutoLogin";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();
  useTelegramWebApp();
  const tg = useTelegramAutoLogin(!!user);

  // While Telegram auto-login is in progress, keep showing the loader instead of the password screen.
  if (loading || (tg.isTelegram && !user && (tg.status === "idle" || tg.status === "trying"))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xs text-muted-foreground animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth telegram={tg.isTelegram ? { name: tg.tgName, status: tg.status } : undefined} />;
  }


  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/cashflow" element={<CashflowReport />} />
        <Route path="/pnl" element={<PnLReport />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
