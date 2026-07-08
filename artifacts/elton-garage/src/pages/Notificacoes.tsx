import { useState } from 'react';
import { 
  useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Loader2, CheckCircle2, Award, Info, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export default function Notificacoes() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useListNotifications({ page, limit: 30 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
    });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
    });
  };

  const getIcon = (type: string) => {
    if (type.startsWith('reminder')) return <Calendar className="w-5 h-5 text-blue-500" />;
    if (type === 'loyalty') return <Award className="w-5 h-5 text-amber-500" />;
    return <Info className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Bell className="w-8 h-8" /> Central de Notificações
        </h1>
        <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending || !data?.data?.some(n => !n.read)}>
          <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar todas como lidas
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data?.data.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg bg-secondary/10">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-lg">Você não tem notificações</p>
          </div>
        ) : (
          data?.data.map((notif) => (
            <Card key={notif.id} className={`border-l-4 transition-colors ${!notif.read ? 'border-l-primary bg-primary/5' : 'border-l-border bg-card'}`}>
              <CardContent className="p-4 flex gap-4 items-start">
                <div className="bg-background p-2 rounded-full border border-border shrink-0 mt-1">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className={`font-semibold text-base ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(notif.createdAt), "dd/MM 'às' HH:mm")}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notif.message}
                  </p>
                  {notif.customer && (
                    <Badge variant="outline" className="mt-3 bg-background">
                      Cliente: {notif.customer.name}
                    </Badge>
                  )}
                </div>
                {!notif.read && (
                  <Button variant="ghost" size="icon" onClick={() => handleMarkRead(notif.id)} className="shrink-0 text-muted-foreground hover:text-primary" title="Marcar como lida">
                    <CheckCircle2 className="w-5 h-5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <div className="flex items-center px-4 text-sm font-medium">Página {page} de {data.meta.totalPages}</div>
          <Button variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}