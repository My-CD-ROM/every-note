import { Sidebar } from './Sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useUIStore } from '@/stores/ui-store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar — no Sheet, no portal, no overlay */}
      {sidebarOpen && (
        <aside className="hidden md:flex">
          <Sidebar />
        </aside>
      )}

      {/* Mobile sidebar — Sheet closed by default, opens on hamburger tap */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 md:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
