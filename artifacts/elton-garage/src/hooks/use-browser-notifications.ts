import { useEffect, useRef } from 'react';
import { useListNotifications } from '@workspace/api-client-react';

/**
 * Hook para ativar notificações do navegador
 * Monitora notificações não lidas e dispara alertas do sistema
 */
export function useBrowserNotifications() {
  const prevNotificationsRef = useRef<Set<number>>(new Set());
  const { data: notifications } = useListNotifications({ read: false, limit: 100 });

  // Solicitar permissão ao montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Monitorar novas notificações
  useEffect(() => {
    if (!notifications?.data || Notification.permission !== 'granted') {
      return;
    }

    const currentIds = new Set(notifications.data.map((n) => n.id));

    for (const notification of notifications.data) {
      // Se é uma notificação nova (não estava antes)
      if (!prevNotificationsRef.current.has(notification.id)) {
        const title = getNotificationTitle(notification.type);
        const options: NotificationOptions = {
          body: notification.message || notification.title,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `notification-${notification.id}`,
          requireInteraction: notification.type?.includes('reminder') || notification.type?.includes('appointment'),
        };

        // Adicionar avatar se houver customer
        if (notification.customer?.name) {
          options.body = `${notification.customer.name}\n${options.body}`;
        }

        try {
          const notif = new Notification(title, options);

          // Ao clicar na notificação, focar a app
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } catch (err) {
          console.error('Erro ao disparar notificação do navegador:', err);
        }
      }
    }

    // Atualizar set de IDs já vistas
    prevNotificationsRef.current = currentIds;
  }, [notifications?.data]);
}

/**
 * Gera o título da notificação baseado no tipo
 */
function getNotificationTitle(type?: string): string {
  const typeMap: Record<string, string> = {
    appointment_reminder: '📅 Agendamento se aproximando',
    reminder_1d: '📅 Agendamento amanhã',
    reminder_15d: '📅 Agendamento em 15 dias',
    reminder_30d: '📅 Agendamento em 30 dias',
    reminder_45d: '📅 Agendamento em 45 dias',
    feedback: '⭐ Novo feedback',
    maintenance: '🚗 Manutenção necessária',
    return: '🎯 Solicitação de retorno',
    service_completed: '✅ Serviço concluído',
    loyalty: '🎁 Programa de fidelidade',
    system: 'ℹ️ Notificação do sistema',
    inventory: '📦 Alerta de inventário',
    financial: '💰 Alerta financeiro',
  };

  return typeMap[type || 'system'] || '🔔 Nova notificação';
}

/**
 * Função auxiliar para disparar notificação manual (sem passar pelo API)
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return notif;
    } catch (err) {
      console.error('Erro ao disparar notificação:', err);
      return null;
    }
  }
  return null;
}
