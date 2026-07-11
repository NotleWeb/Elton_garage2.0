import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export function AppLayout({ children }: { children: ReactNode }) {
  const { token, isLoading } = useAuth();
  const [location] = useLocation();

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
      <div className="flex min-h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto py-8">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}