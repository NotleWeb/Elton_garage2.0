import { db, getById, nextId, nowIso } from "../db.js";

export function getBusinessDate(date: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.BUSINESS_TIMEZONE || "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function ensureAppointmentRevenueTransaction(
  appointmentId: number,
  paymentMethod?: string | null,
): Promise<boolean> {
  const existing = await db
    .collection("financial_transactions")
    .where("appointment_id", "==", appointmentId)
    .where("type", "==", "receita")
    .limit(1)
    .get();

  if (!existing.empty) {
    if (paymentMethod) {
      await existing.docs[0].ref.update({ payment_method: paymentMethod });
    }
    return false;
  }

  const appointment = await getById("appointments", appointmentId) as any;
  if (!appointment) return false;

  const serviceLinks = await db
    .collection("appointment_services")
    .where("appointment_id", "==", appointmentId)
    .get();
  const services = await Promise.all(
    serviceLinks.docs.map((doc) => getById("services", Number((doc.data() as any).service_id))),
  );
  const serviceNames = services.filter(Boolean).map((service: any) => service.name).join(", ");
  const customer = await getById("customers", Number(appointment.customer_id)) as any;
  const amount = Number(appointment.final_price ?? 0);
  const transactionId = await nextId("financial_transactions");

  await db.collection("financial_transactions").doc(String(transactionId)).set({
    type: "receita",
    category: "Servicos",
    description: `${serviceNames} - ${customer?.name ?? ""}`,
    amount,
    date: getBusinessDate(nowIso()),
    appointment_id: appointmentId,
    payment_method: paymentMethod ?? null,
    created_at: nowIso(),
  });

  return true;
}