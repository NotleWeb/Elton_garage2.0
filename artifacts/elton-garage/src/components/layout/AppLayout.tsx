import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';

// ---------------------------------------------------------------------------
// Layout principal da aplicação
// ---------------------------------------------------------------------------
// Define a estrutura visual da interface: sidebar, cabeçalho e área central.
// Também controla a exibição do conteúdo conforme autenticação e responsividade.

export function AppLayout({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Carregando...</div>;
  }

  if (!token && location !== '/login') {
    return null;
  }

  if (location === '/login') {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen overflow-hidden overflow-x-hidden bg-background">
        <Sidebar />
        <div className="flex w-full min-h-screen flex-1 min-w-0 flex-col overflow-hidden">
          <Header />
          <main className={`flex-1 overflow-y-auto ${isMobile ? 'py-4' : 'py-6 lg:py-8'}`}>
            <div className={`w-full min-w-0 ${isMobile ? 'px-3' : 'px-4 sm:px-6 lg:px-8 xl:px-10'}`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}