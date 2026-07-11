import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, Calendar, Users, Car, Wrench, 
  Package, DollarSign, ClipboardList, BarChart3, 
  Award, Bell, Star, UsersRound, Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useListNotifications } from '@workspace/api-client-react';
import { Sidebar as UISidebar, useSidebar } from '@/components/ui/sidebar';

const MENU_GROUPS = [
  {
    title: 'Principal',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }]
  },
  {
    title: 'Operações',
    items: [
      { label: 'Agendamentos', href: '/agendamentos', icon: Calendar }
    ]
  },
  {
    title: 'Cadastros',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users },
      { label: 'Veículos', href: '/veiculos', icon: Car },
      { label: 'Serviços', href: '/servicos', icon: Wrench },
      { label: 'Produtos', href: '/produtos', icon: Package }
    ]
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Financeiro', href: '/financeiro', icon: DollarSign },
      { label: 'Inventário', href: '/inventario', icon: ClipboardList },
      { label: 'Relatórios', href: '/relatorios', icon: BarChart3 }
    ]
  },
  {
    title: 'Fidelidade & Atendimento',
    items: [
      { label: 'Fidelidade', href: '/fidelidade', icon: Award },
      { label: 'Notificações', href: '/notificacoes', icon: Bell, badge: true },
      { label: 'Avaliações', href: '/avaliacoes', icon: Star }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Usuários', href: '/usuarios', icon: UsersRound },
      { label: 'Configurações', href: '/configuracoes', icon: Settings }
    ]
  }
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: notifications } = useListNotifications({ read: false });
  const unreadCount = notifications?.unreadCount || 0;
  const sidebar = useSidebar();
  const isMobile = sidebar?.isMobile;
  const setOpenMobile = sidebar?.setOpenMobile;

  return (
    <UISidebar className="border-r border-border bg-card">
      <div className="h-16 flex items-center px-4 border-b border-border">
        <h1 className="text-xl font-bold text-primary tracking-tight">Elton Garage</h1>
      </div>
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {MENU_GROUPS.map(group => (
          <div key={group.title} className="px-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {group.title}
            </h2>
            <div className="space-y-1">
              {group.items.map(item => {
                const isActive = location === item.href || location.startsWith(`${item.href}/`);
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => { if (isMobile && typeof setOpenMobile === 'function') setOpenMobile(false); }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-foreground hover:bg-secondary hover:text-foreground"
                    )}
                    >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {item.badge && unreadCount > 0 && (
                      <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </UISidebar>
  );
}