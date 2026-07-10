import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { useEffect } from 'react';
import { setBaseUrl } from '@workspace/api-client-react';

// Aponta o cliente para a URL da API configurada via variável de ambiente.
// Em produção (Netlify): defina VITE_API_URL no painel do Netlify.
// Ex: https://seu-app.replit.app
// Em desenvolvimento (Replit): deixe vazio — usa URLs relativas automaticamente.
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl);

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clientes from '@/pages/Clientes';
import ClienteDetail from '@/pages/ClienteDetail';
import Veiculos from '@/pages/Veiculos';
import Servicos from '@/pages/Servicos';
import Produtos from '@/pages/Produtos';
import Inventario from '@/pages/Inventario';
import Agendamentos from '@/pages/Agendamentos';
import AgendamentoDetail from '@/pages/AgendamentoDetail';
import Financeiro from '@/pages/Financeiro';
import Relatorios from '@/pages/Relatorios';
import Fidelidade from '@/pages/Fidelidade';
import Notificacoes from '@/pages/Notificacoes';
import Avaliacoes from '@/pages/Avaliacoes';
import Usuarios from '@/pages/Usuarios';
import Configuracoes from '@/pages/Configuracoes';

// Redirect component — calls navigate inside a component body (hook-safe)
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}

function AppRouter() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-primary">
        Carregando...
      </div>
    );
  }

  // Not authenticated: only allow /login, redirect everything else
  if (!token) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  // Authenticated: full app with layout
  return (
    <AppLayout>
      <Switch>
        <Route path="/" ><Redirect to="/dashboard" /></Route>
        <Route path="/login"><Redirect to="/dashboard" /></Route>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/agendamentos" component={Agendamentos} />
        <Route path="/agendamentos/:id" component={AgendamentoDetail} />
        <Route path="/clientes" component={Clientes} />
        <Route path="/clientes/:id" component={ClienteDetail} />
        <Route path="/veiculos" component={Veiculos} />
        <Route path="/servicos" component={Servicos} />
        <Route path="/produtos" component={Produtos} />
        <Route path="/inventario" component={Inventario} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/relatorios" component={Relatorios} />
        <Route path="/fidelidade" component={Fidelidade} />
        <Route path="/notificacoes" component={Notificacoes} />
        <Route path="/avaliacoes" component={Avaliacoes} />
        <Route path="/usuarios" component={Usuarios} />
        <Route path="/configuracoes" component={Configuracoes} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
