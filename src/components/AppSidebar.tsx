import {
  LayoutDashboard,
  List,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard },
  { title: "Операции", url: "/transactions", icon: List },
  { title: "Счета", url: "/accounts", icon: Wallet },
  { title: "ДДС Отчёт", url: "/cashflow", icon: BarChart3 },
  { title: "ОПУ Отчёт", url: "/pnl", icon: TrendingUp },
  { title: "Настройки", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-xs">F</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-accent-foreground">FinanceERP</h2>
            <p className="text-[10px] text-sidebar-foreground/60">Управление финансами</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest mb-1">
            Навигация
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-9">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-sm"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-2.5 h-9 px-2.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Выйти</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
