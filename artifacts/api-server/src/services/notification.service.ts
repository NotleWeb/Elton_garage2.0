import { db, createDoc, updateDocById, nowIso } from "../db.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationSubtype =
  | "appointment_reminder"
  | "feedback_1d"
  | "maintenance_15d"
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

// ---------------------------------------------------------------------------
// Appointment reminder deduplication — per appointment, per subtype
// ---------------------------------------------------------------------------

async function hasDuplicateAppointmentReminder(appointmentId: number): Promise<boolean> {
  const snap = await db
    .collection("notifications")
    .where("appointment_id", "==", appointmentId)
    .where("subtype", "==", "appointment_reminder")
    .limit(1)
    .get();
  return !snap.empty;
}

// ---------------------------------------------------------------------------
// Follow-up upsert — one active reminder per customer per subtype
//
// Strategy: update the existing UNREAD reminder if found (latest appointment
// wins), create a new one otherwise. This satisfies the business rule
// "always use the latest completed appointment of each customer".
// ---------------------------------------------------------------------------

async function upsertFollowUp(input: {
  customer_id: number;
  appointment_id: number;
  title: string;
  message: string;
  type: string;
  subtype: NotificationSubtype;
  scheduled_for: string;
}): Promise<void> {
  // Look for an existing pending (unread, not completed) follow-up for this
  // customer and subtype — these are the ones we should refresh.
  const snap = await db
    .collection("notifications")
    .where("customer_id", "==", input.customer_id)
    .where("subtype", "==", input.subtype)
    .where("read", "==", 0)
    .limit(1)
    .get();

  if (!snap.empty) {
    // Update in-place so the latest completion drives the timing
    const docId = Number(snap.docs[0].id);
    await updateDocById("notifications", docId, {
      appointment_id: input.appointment_id,
      title: input.title,
      message: input.message,
      scheduled_for: input.scheduled_for,
    });
  } else {
    // Create fresh record
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

  if (await hasDuplicateAppointmentReminder(appointmentId)) return;

  const aptDate = new Date(appointmentDate);
  const reminderAt = new Date(aptDate.getTime() - 60 * 60 * 1000);
  const timeStr = aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const svcList = serviceNames.length > 0
    ? serviceNames.map((s) => `• ${s}`).join("\n")
    : "• Serviço não especificado";

  const plateStr = plate ? `\n\nPlaca: ${plate}` : "";

  await createNotification({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Agendamento em breve",
    message: `O cliente ${customerName} possui um atendimento agendado para hoje às ${timeStr}.\n\nServiços:\n${svcList}\n\nVeículo: ${vehicleInfo}${plateStr}`,
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
  await upsertFollowUp({
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
  await upsertFollowUp({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Lavagem de manutenção",
    message: `${customerName} realizou o último serviço há 15 dias. Considere oferecer uma lavagem de manutenção.`,
    type: "maintenance",
    subtype: "maintenance_15d",
    scheduled_for: day15.toISOString(),
  });

  // 30 days → return reminder
  const day30 = new Date(base);
  day30.setDate(day30.getDate() + 30);
  await upsertFollowUp({
    customer_id: customerId,
    appointment_id: appointmentId,
    title: "Trazer cliente de volta",
    message: `${customerName} está há mais de 30 dias sem retornar. Considere enviar uma promoção ou realizar contato para um novo agendamento.`,
    type: "return",
    subtype: "return_30d",
    scheduled_for: day30.toISOString(),
  });
}
