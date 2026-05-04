import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <AppSidebar />}
        <main className="flex-1 flex flex-col min-w-0">
          {!isMobile && (
            <header className="h-11 flex items-center border-b bg-card px-3 shrink-0">
              <SidebarTrigger className="h-7 w-7" />
            </header>
          )}
          <div className={`flex-1 overflow-auto ${isMobile ? "pb-safe-offset" : ""}`}>
            {children}
          </div>
        </main>
        {isMobile && <MobileBottomNav />}
      </div>
    </SidebarProvider>
  );
}
