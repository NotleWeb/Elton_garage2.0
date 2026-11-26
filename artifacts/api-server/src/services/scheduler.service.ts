import { db, getAll, getById } from "../db.js";
import { scheduleFollowUpReminders, scheduleAppointmentReminder } from "./notification.service.js";
import { logger } from "../lib/logger.js";

type FollowUpSubtype = "feedback_1d" | "maintenance_15d" | "return_30d";

// ---------------------------------------------------------------------------
// Build a Set of customer IDs that already have an unread pending follow-up
// for a given subtype — used to skip backfilling where not needed.
// ---------------------------------------------------------------------------

async function customerIdsWithPendingFollowUp(subtype: FollowUpSubtype): Promise<Set<number>> {
  const snap = await db
    .collection("notifications")
    .where("subtype", "==", subtype)
    .where("read", "==", 0)
    .get();
  const ids = new Set<number>();
  snap.docs.forEach((d) => {
    const cid = (d.data() as any).customer_id;
    if (cid != null) ids.add(Number(cid));
  });
  return ids;
}

// ---------------------------------------------------------------------------
// Follow-up generator — for each completed appointment, ensure all 3 follow-up
// subtypes exist at the customer level. Uses per-subtype query to avoid
// unnecessary creates.
// ---------------------------------------------------------------------------

async function generateMissingFollowUps(): Promise<void> {
  const appointments = (await getAll("appointments")) as any[];
  const completed = appointments.filter((a) => a.status === "concluido");
  if (completed.length === 0) return;

  // Gather which customers already have each subtype (single query per subtype)
  const [hasFeedback, hasMaintenance, hasReturn] = await Promise.all([
    customerIdsWithPendingFollowUp("feedback_1d"),
    customerIdsWithPendingFollowUp("maintenance_15d"),
    customerIdsWithPendingFollowUp("return_30d"),
  ]);

  // Group completed appointments by customer, keep only the latest per customer
  const latestByCustomer = new Map<number, any>();
  for (const apt of completed) {
    const cid = apt.customer_id as number;
    const existing = latestByCustomer.get(cid);
    const aptDate = apt.updated_at ?? apt.appointment_date ?? apt.created_at ?? "";
    const existingDate = existing
      ? (existing.updated_at ?? existing.appointment_date ?? existing.created_at ?? "")
      : "";
    if (!existing || aptDate > existingDate) {
      latestByCustomer.set(cid, apt);
    }
  }

  for (const [customerId, apt] of latestByCustomer) {
    const needsFeedback = !hasFeedback.has(customerId);
    const needsMaintenance = !hasMaintenance.has(customerId);
    const needsReturn = !hasReturn.has(customerId);

    if (!needsFeedback && !needsMaintenance && !needsReturn) continue;

    const customer = (await getById("customers", customerId)) as any;
    if (!customer) continue;

    const completionDate = apt.updated_at ?? apt.appointment_date ?? apt.created_at;

    await scheduleFollowUpReminders({
      appointmentId: apt.id,
      customerId,
      customerName: customer.name,
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
// Scheduler bootstrap — runs once on startup then every hour
// ---------------------------------------------------------------------------

async function runJobs(): Promise<void> {
  await Promise.allSettled([
    generateMissingFollowUps(),
    generateMissingAppointmentReminders(),
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
