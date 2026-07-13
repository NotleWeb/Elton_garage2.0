import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente que gerencia permissões de notificação do navegador
 */
export function NotificationToggle() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Verificar estado atual
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleToggle = async () => {
    if (!('Notification' in window)) {
      toast({
        title: 'Notificações não suportadas',
        description: 'Seu navegador não suporta notificações',
        variant: 'destructive',
      });
      return;
    }

    if (permission === 'granted') {
      // Mostrar menu para desativar (manual)
      toast({
        title: 'Notificações ativas',
        description: 'Vá em Configurações do navegador para desativar',
      });
      return;
    }

    if (permission === 'denied') {
      toast({
        title: 'Notificações bloqueadas',
        description: 'Permita notificações nas configurações do navegador',
        variant: 'destructive',
      });
      return;
    }

    // permission === 'default': solicitar permissão
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      toast({
        title: '✓ Notificações ativadas',
        description: 'Você receberá alertas de agendamentos e notificações',
      });

      // Disparar notificação de teste
      try {
        new Notification('Notificações Ativadas! 🎉', {
          body: 'Você receberá alertas de agendamentos e outras notificações do sistema',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      } catch (err) {
        console.error('Erro ao disparar notificação de teste:', err);
      }
    } else if (result === 'denied') {
      toast({
        title: 'Notificações bloqueadas',
        description: 'Você pode permitir notificações nas configurações do navegador',
        variant: 'destructive',
      });
    }
  };

  // Determinar ícone e tooltip baseado no status
  const getIconAndTooltip = () => {
    switch (permission) {
      case 'granted':
        return {
          icon: <BellRing className="w-5 h-5 text-emerald-500" />,
          tooltip: 'Notificações ativas',
        };
      case 'denied':
        return {
          icon: <BellOff className="w-5 h-5 text-red-500" />,
          tooltip: 'Notificações bloqueadas',
        };
      default:
        return {
          icon: <Bell className="w-5 h-5" />,
          tooltip: 'Ativar notificações',
        };
    }
  };

  const { icon, tooltip } = getIconAndTooltip();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
