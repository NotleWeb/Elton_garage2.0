import { useEffect, useRef } from 'react';
import { useGetUpcomingAppointments } from '@workspace/api-client-react';
import { showBrowserNotification } from '@/hooks/use-browser-notifications';

/**
 * Hook que monitora agendamentos próximos e notifica o usuário
 * Dispara notificação quando um agendamento está se aproximando (30 min, 1h, etc)
 */
export function useUpcomingAppointmentNotifications() {
  const prevAppointmentsRef = useRef<Set<number>>(new Set());
  const { data: upcoming } = useGetUpcomingAppointments({ limit: 10 });

  useEffect(() => {
    if (!upcoming?.data) return;

    const currentIds = new Set(upcoming.data.map((apt) => apt.id));

    for (const appointment of upcoming.data) {
      // Se é um agendamento novo (não notificado antes)
      if (!prevAppointmentsRef.current.has(appointment.id)) {
        const appointmentTime = new Date(appointment.appointmentDate).getTime();
        const now = Date.now();
        const diffMs = appointmentTime - now;
        const diffMins = Math.floor(diffMs / 1000 / 60);

        // Notificar se estiver entre 30 min a 24h antes
        if (diffMins > 0 && diffMins <= 1440) {
          const timeLabel =
            diffMins < 60
              ? `${diffMins} minutos`
              : diffMins < 120
                ? '1 hora'
                : `${Math.floor(diffMins / 60)} horas`;

          showBrowserNotification(
            `📅 Agendamento em ${timeLabel}`,
            {
              body: `${appointment.customer?.name || 'Cliente'} - ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n${appointment.appointmentDate}`,
              tag: `appointment-${appointment.id}`,
              requireInteraction: diffMins <= 30, // Obrigar interação se < 30 min
            }
          );
        }
      }
    }

    prevAppointmentsRef.current = currentIds;
  }, [upcoming?.data]);
}
