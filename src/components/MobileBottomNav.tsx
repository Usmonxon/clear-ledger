import { LayoutDashboard, List, Wallet, BarChart3, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const tabs = [
  { label: "Главная", icon: LayoutDashboard, to: "/" },
  { label: "Операции", icon: List, to: "/transactions" },
  { label: "Счета", icon: Wallet, to: "/accounts" },
  { label: "Отчёты", icon: BarChart3, to: "/cashflow" },
  { label: "Ещё", icon: Settings, to: "/settings" },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t flex items-center justify-around pb-safe">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className="flex flex-col items-center gap-1 pt-2.5 pb-2 px-3 text-muted-foreground transition-colors min-w-0"
          activeClassName="text-primary"
        >
          <tab.icon className="h-6 w-6" />
          <span className="text-xs leading-tight font-medium">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
