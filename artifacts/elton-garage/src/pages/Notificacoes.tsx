import { useState, useMemo } from 'react';
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useCompleteNotification,
  useArchiveNotification,
  useDeleteNotification,
  getListNotificationsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Loader2, CheckCircle2, Calendar, Star, Car, Target,
  Info, Package, DollarSign, Archive, Trash2, Check, Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  appointment_reminder: {
    label: 'Agendamento',
    icon: <Bell className="w-4 h-4" />,
    color: 'text-blue-500',
  },
  feedback: {
    label: 'Feedback',
    icon: <Star className="w-4 h-4" />,
    color: 'text-amber-500',
  },
  maintenance: {
    label: 'Manutenção',
    icon: <Car className="w-4 h-4" />,
    color: 'text-green-500',
  },
  return: {
    label: 'Retorno',
    icon: <Target className="w-4 h-4" />,
    color: 'text-purple-500',
  },
  service_completed: {
    label: 'Serviço',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-emerald-500',
  },
  system: {
    label: 'Sistema',
    icon: <Info className="w-4 h-4" />,
    color: 'text-slate-500',
  },
  inventory: {
    label: 'Inventário',
    icon: <Package className="w-4 h-4" />,
    color: 'text-orange-500',
  },
  financial: {
    label: 'Financeiro',
    icon: <DollarSign className="w-4 h-4" />,
    color: 'text-rose-500',
  },
};

function getTypeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: 'Notificação',
      icon: <Info className="w-4 h-4" />,
      color: 'text-primary',
    }
  );
}

function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

type ReadFilter = 'all' | 'unread' | 'read';

const READ_TABS: { value: ReadFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'unread', label: 'Não lidas' },
  { value: 'read', label: 'Lidas' },
];

const TYPE_FILTERS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'appointment_reminder', label: '🔔 Agendamento' },
  { value: 'feedback', label: '⭐ Feedback' },
  { value: 'maintenance', label: '🚗 Manutenção' },
  { value: 'return', label: '🎯 Retorno' },
  { value: 'service_completed', label: '✅ Serviço concluído' },
  { value: 'system', label: 'ℹ️ Sistema' },
  { value: 'inventory', label: '📦 Inventário' },
  { value: 'financial', label: '💰 Financeiro' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Notificacoes() {
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const queryClient = useQueryClient();

  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, limit: 20 };
    if (readFilter === 'unread') params.read = false;
    if (readFilter === 'read') params.read = true;
    if (typeFilter) params.type = typeFilter;
    return params;
  }, [page, readFilter, typeFilter]);

  const { data, isLoading } = useListNotifications(queryParams);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const complete = useCompleteNotification();
  const archive = useArchiveNotification();
  const del = useDeleteNotification();

  const handleTabChange = (tab: ReadFilter) => {
    setReadFilter(tab);
    setPage(1);
  };

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    setPage(1);
  };

  const act = (fn: () => void) => {
    fn();
    // Optimistic: invalidate after a short delay to allow mutation to land
    setTimeout(invalidate, 300);
  };

  const activeTypeLabel = TYPE_FILTERS.find((t) => t.value === typeFilter)?.label ?? 'Todos os tipos';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8" /> Central de Notificações
          </h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.unreadCount > 0
                ? `${data.unreadCount} não lida${data.unreadCount !== 1 ? 's' : ''}`
                : 'Todas as notificações lidas'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => act(() => markAllRead.mutate(undefined))}
          disabled={markAllRead.isPending || !data?.unreadCount}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar todas como lidas
        </Button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Read/unread tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {READ_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                readFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-3.5 h-3.5" />
              {activeTypeLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TYPE_FILTERS.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => handleTypeChange(t.value)}
                className={typeFilter === t.value ? 'bg-primary/10 text-primary' : ''}
              >
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Notification list ── */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : data?.data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-lg">Nenhuma notificação encontrada</p>
            <p className="text-sm mt-1 opacity-70">
              {typeFilter || readFilter !== 'all' ? 'Tente remover os filtros' : 'Você está em dia!'}
            </p>
          </div>
        ) : (
          data?.data.map((notif) => {
            const meta = getTypeMeta(notif.type);
            return (
              <Card
                key={notif.id}
                className={`border-l-4 transition-colors ${
                  notif.completed
                    ? 'border-l-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 opacity-75'
                    : !notif.read
                    ? 'border-l-primary bg-primary/5'
                    : 'border-l-border bg-card'
                }`}
              >
                <CardContent className="p-4 flex gap-4 items-start">
                  {/* Icon */}
                  <div
                    className={`bg-background p-2 rounded-full border border-border shrink-0 mt-0.5 ${meta.color}`}
                  >
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`font-semibold text-sm ${
                            !notif.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {notif.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {meta.label}
                        </Badge>
                        {notif.completed && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500">
                            Concluída
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {relativeDate(notif.createdAt)}
                      </span>
                    </div>

                    <p
                      className={`mt-1 text-sm whitespace-pre-line leading-relaxed ${
                        !notif.read ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {notif.message}
                    </p>

                    {notif.customer && (
                      <Badge variant="outline" className="mt-2 bg-background text-xs">
                        Cliente: {notif.customer.name}
                      </Badge>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {!notif.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Marcar como lida"
                        onClick={() => act(() => markRead.mutate({ id: notif.id }))}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    {!notif.completed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-emerald-500"
                        title="Marcar como concluída"
                        onClick={() => act(() => complete.mutate({ id: notif.id }))}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                      title="Arquivar"
                      onClick={() => act(() => archive.mutate({ id: notif.id }))}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Excluir"
                      onClick={() => act(() => del.mutate({ id: notif.id }))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <div className="flex items-center px-4 text-sm font-medium">
            Página {page} de {data.meta.totalPages}
          </div>
          <Button
            variant="outline"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
