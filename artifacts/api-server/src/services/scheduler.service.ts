import { db, getAll, getById } from "../db.js";
import { scheduleFollowUpReminders, scheduleAppointmentReminder } from "./notification.service.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Agendador de lembretes e follow-up
// ---------------------------------------------------------------------------
// O sistema gera notificações automaticamente com base em agendamentos
// concluídos e próximos. Esse serviço evita duplicidade e mantém o fluxo
// de comunicação operacional ativo sem intervenção manual.

// ---------------------------------------------------------------------------
// Follow-up generator — for each completed appointment, ensure follow-ups
// exist. scheduleFollowUpReminders is idempotent per appointment+subtype.
// ---------------------------------------------------------------------------

async function generateMissingFollowUps(): Promise<void> {
  const appointments = (await getAll("appointments")) as any[];
  const completed = appointments.filter((a) => a.status === "concluido");
  if (completed.length === 0) return;

  const customers = (await getAll("customers")) as any[];
  const customerNameById = new Map<number, string>(
    customers.map((c: any) => [Number(c.id), String(c.name ?? "")]),
  );

  for (const apt of completed) {
    const customerId = Number(apt.customer_id);
    if (!Number.isFinite(customerId)) continue;
    const customerName = customerNameById.get(customerId);
    if (!customerName) continue;

    const completionDate = apt.updated_at ?? apt.appointment_date ?? apt.created_at;
    if (!completionDate) continue;

    await scheduleFollowUpReminders({
      appointmentId: Number(apt.id),
      customerId,
      customerName,
      completionDate,
    });
  }
}

// ---------------------------------------------------------------------------
// Appointment reminder generator — ensures upcoming appointments in the next
// 48 hours have their 1-hour-before reminder created.
// ---------------------------------------------------------------------------

async function generateMissingAppointmentReminders(): Promise<void> {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const appointments = (await getAll("appointments")) as any[];
  const upcoming = appointments.filter((a) => {
    if (a.status !== "agendado" && a.status !== "em_andamento") return false;
    const aptDate = new Date(a.appointment_date);
    return aptDate > now && aptDate <= in48h;
  });

  for (const apt of upcoming) {
    // Deduplication is handled inside scheduleAppointmentReminder
    const [customer, vehicle] = await Promise.all([
      getById("customers", apt.customer_id),
      getById("vehicles", apt.vehicle_id),
    ]) as [any, any];

    if (!customer) continue;

    const aptSvcSnap = await db
      .collection("appointment_services")
      .where("appointment_id", "==", apt.id)
      .get();
    const svcIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
    const services = await Promise.all(svcIds.map((sid) => getById("services", sid))) as any[];
    const validServices = services.filter(Boolean);

    const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model}` : "";
    const plate = vehicle?.plate ?? "";

    await scheduleAppointmentReminder({
      appointmentId: apt.id,
      appointmentDate: apt.appointment_date,
      customerId: apt.customer_id,
      customerName: customer.name,
      vehicleInfo,
      plate,
      serviceNames: validServices.map((s: any) => s.name),
    });
  }
}

// ---------------------------------------------------------------------------
// Reconcile existing appointment reminder messages so previously generated
// records also reflect the latest formatting rules (including timezone).
// ---------------------------------------------------------------------------

async function reconcileAppointmentReminderMessages(): Promise<void> {
  const notifications = (await getAll("notifications")) as any[];
  const appointments = (await getAll("appointments")) as any[];
  const reminderAppointmentIds = Array.from(new Set(
    notifications
      .filter((n) => n.subtype === "appointment_reminder" && n.appointment_id != null)
      .map((n) => Number(n.appointment_id))
      .filter((id) => Number.isFinite(id)),
  ));

  for (const appointmentId of reminderAppointmentIds) {
    const apt = appointments.find((a) => Number(a.id) === appointmentId);
    if (!apt) continue;

    const [customer, vehicle] = await Promise.all([
      getById("customers", Number(apt.customer_id)),
      getById("vehicles", Number(apt.vehicle_id)),
    ]) as [any, any];

    if (!customer) continue;

    const aptSvcSnap = await db
      .collection("appointment_services")
      .where("appointment_id", "==", appointmentId)
      .get();

    const svcIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
    const services = await Promise.all(svcIds.map((sid) => getById("services", sid))) as any[];
    const validServices = services.filter(Boolean);

    await scheduleAppointmentReminder({
      appointmentId,
      appointmentDate: apt.appointment_date,
      customerId: Number(apt.customer_id),
      customerName: customer.name,
      vehicleInfo: vehicle ? `${vehicle.brand} ${vehicle.model}` : "",
      plate: vehicle?.plate ?? "",
      serviceNames: validServices.map((s: any) => s.name),
    });
  }
}

// ---------------------------------------------------------------------------
// Scheduler bootstrap — runs once on startup then every hour
// ---------------------------------------------------------------------------

async function runJobs(): Promise<void> {
  await Promise.allSettled([
    generateMissingFollowUps(),
    generateMissingAppointmentReminders(),
    reconcileAppointmentReminderMessages(),
  ]);
}

export function startScheduler(): void {
  // Defer initial run so the DB has time to fully warm up
  setTimeout(() => {
    runJobs().catch((err) => logger.error({ err }, "Scheduler: initial run failed"));
  }, 5000);

  setInterval(() => {
    runJobs().catch((err) => logger.error({ err }, "Scheduler: periodic run failed"));
  }, 60 * 60 * 1000);

  logger.info("Notification scheduler started (hourly cadence)");
}
