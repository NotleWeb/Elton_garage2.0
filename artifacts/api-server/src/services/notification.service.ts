import { db, createDoc, nowIso, updateDocById } from "../db.js";

// ---------------------------------------------------------------------------
// Serviço de notificações do sistema
// ---------------------------------------------------------------------------
// Este módulo é responsável por criar, deduplicar e programar lembretes
// relacionados a agendamentos, feedbacks e manutenção preventiva.
// Ele atua como central de comunicação entre o negócio e o cliente.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationSubtype =
  | "appointment_reminder"
  | "feedback_1d"
  | "maintenance_15d"
  | "maintenance_30d"
  | "return_30d";

export interface CreateNotificationInput {
  customer_id: number | null;
  appointment_id: number | null;
  title: string;
  message: string;
  type: string;
  subtype?: NotificationSubtype | null;
  scheduled_for?: string | null;
}

export interface AppointmentReminderParams {
  appointmentId: number;
  appointmentDate: string;
  customerId: number;
  customerName: string;
  vehicleInfo: string;
  plate: string;
  serviceNames: string[];
}

export interface FollowUpReminderParams {
  appointmentId: number;
  customerId: number;
  customerName: string;
  completionDate: string;
}

function formatBusinessTime(isoDateTime: string): string {
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) return isoDateTime;

  const timeZone = process.env.BUSINESS_TIMEZONE || "America/Sao_Paulo";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(parsed);
}

// ---------------------------------------------------------------------------
// Appointment reminder deduplication — per appointment, per subtype
// ---------------------------------------------------------------------------

async function findAppointmentReminderId(appointmentId: number): Promise<number | null> {
  const snap = await db
    .collection("notifications")
    .where("appointment_id", "==", appointmentId)
    .where("subtype", "==", "appointment_reminder")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return Number(snap.docs[0].id);
}

// ---------------------------------------------------------------------------
// Follow-up deduplication — one reminder per appointment and subtype
// ---------------------------------------------------------------------------

async function createFollowUpIfMissing(input: {
  customer_id: number;
  appointment_id: number;
  title: string;
  message: string;
  type: string;
  subtype: NotificationSubtype;
  scheduled_for: string;
}): Promise<void> {
  // Keep idempotent behavior: if the reminder for this appointment+subtype
  // already exists (read/completed/archived or not), do not create another.
  const snap = await db
    .collection("notifications")
    .where("appointment_id", "==", input.appointment_id)
    .where("subtype", "==", input.subtype)
    .limit(1)
    .get();

  if (!snap.empty) return;

  await createDoc("notifications", {
    customer_id: input.customer_id,
    appointment_id: input.appointment_id,
    title: input.title,
    message: input.message,
    type: input.type,
    subtype: input.subtype,
    scheduled_for: input.scheduled_for,
    read: 0,
    read_at: null,
    completed: 0,
    completed_at: null,
    archived: 0,
    created_at: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Core creation (for immediate / non-follow-up notifications)
// ---------------------------------------------------------------------------

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await createDoc("notifications", {
    customer_id: input.customer_id ?? null,
    appointment_id: input.appointment_id ?? null,
    title: input.title,
    message: input.message,
    type: input.type,
    subtype: input.subtype ?? null,
    scheduled_for: input.scheduled_for ?? null,
    read: 0,
    read_at: null,
    completed: 0,
    completed_at: null,
    archived: 0,
    created_at: nowIso(),
  });
}

// ---------------------------------------------------------------------------
// Appointment reminder — 1 hour before scheduled time
// ---------------------------------------------------------------------------

export async function scheduleAppointmentReminder(params: AppointmentReminderParams): Promise<void> {
  const { appointmentId, appointmentDate, customerId, customerName, vehicleInfo, plate, serviceNames } = params;

  const existingReminderId = await findAppointmentReminderId(appointmentId);

  const aptDate = new Date(appointmentDate);
  const reminderAt = new Date(aptDate.getTime() - 60 * 60 * 1000);
  const timeStr = formatBusinessTime(appointmentDate);

  const svcList = serviceNames.length > 0
    ? serviceNames.map((s) => `• ${s}`).join("\n")
    : "• Serviço não especificado";

  const plateStr = plate ? `\n\nPlaca: ${plate}` : "";

  const title = "Agendamento em breve";
  const message = `O cliente ${customerName} possui um atendimento agendado para hoje às ${timeStr}.\n\nServiços:\n${svcList}\n\nVeículo: ${vehicleInfo}${plateStr}`;

  if (existingReminderId) {
    await updateDocById("notifications", existingReminderId, {
      customer_id: customerId,
      appointment_id: appointmentId,
      title,
      message,
      type: "appointment_reminder",
      subtype: "appointment_reminder",
      scheduled_for: reminderAt.toISOString(),
    });
    return;
  }

  await createNotification({
    customer_id: customerId,
    appointment_id: appointmentId,
    title,
    message,
    type: "appointment_reminder",
    subtype: "appointment_reminder",
    scheduled_for: reminderAt.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Follow-up reminders — based on the customer's latest completed appointment
//
// Uses upsert logic so that completing a new appointment always updates the
// pending reminder chain to reflect the new dates, preventing stale sequences.
// ---------------------------------------------------------------------------

export async function scheduleFollowUpReminders(params: FollowUpReminderParams): Promise<void> {
  const { appointmentId, customerId, customerName, completionDate } = params;
  const base = new Date(completionDate);

  // 1 day → feedback request
  const day1 = new Date(base);
  day1.setDate(day1.getDate() + 1);
  await createFollowUpIfMissing({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Solicitar feedback",
    message: `Entre em contato com ${customerName} e solicite um feedback sobre o atendimento realizado.`,
    type: "feedback",
    subtype: "feedback_1d",
    scheduled_for: day1.toISOString(),
  });

  // 15 days → maintenance wash suggestion
  const day15 = new Date(base);
  day15.setDate(day15.getDate() + 15);
  await createFollowUpIfMissing({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Lavagem de manutenção",
    message: `${customerName} realizou o último serviço há 15 dias. Considere oferecer uma lavagem de manutenção.`,
    type: "maintenance",
    subtype: "maintenance_15d",
    scheduled_for: day15.toISOString(),
  });

  // 30 days → maintenance reminder
  const day30 = new Date(base);
  day30.setDate(day30.getDate() + 30);
  await createFollowUpIfMissing({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Manutenção periódica (30 dias)",
    message: `${customerName} realizou o último serviço há 30 dias. Considere oferecer manutenção preventiva e um novo agendamento.`,
    type: "maintenance",
    subtype: "maintenance_30d",
    scheduled_for: day30.toISOString(),
  });
}
