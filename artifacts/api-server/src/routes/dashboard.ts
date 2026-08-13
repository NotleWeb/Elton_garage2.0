import { Router } from "express";
import { db, getAll } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAppointmentBusinessDate } from "../services/appointment-revenue.js";

const router = Router();
router.use(authMiddleware);

function getTransactionBusinessDate(transaction: any, appointmentDates: Map<number, string>): string {
  if (transaction.type === "receita" && transaction.appointment_id) {
    const appointmentDate = appointmentDates.get(Number(transaction.appointment_id));
    if (appointmentDate) return getAppointmentBusinessDate(appointmentDate);
  }
  return (transaction.date ?? "").slice(0, 10);
}

// GET /dashboard/kpis
router.get("/kpis", async (req, res) => {
  const now = new Date();
  const monthParam = Number(req.query.month);
  const yearParam = Number(req.query.year);
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : now.getFullYear();
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;

  const ym = `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  const prev = new Date(year, month - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  const prevYm = prev.toISOString().slice(0, 7);

  const [appointments, transactions, customers, products, notifications] = await Promise.all([
    getAll("appointments"),
    getAll("financial_transactions"),
    getAll("customers"),
    getAll("products"),
    getAll("notifications"),
  ]);

  const apts = appointments as any[];
  const txs = transactions as any[];
  const appointmentDates = new Map(
    apts.map((appointment) => [Number(appointment.id), appointment.appointment_date]),
  );
  const monthTxs = txs.filter((t) => getTransactionBusinessDate(t, appointmentDates).startsWith(ym));
  const revenueMonth = monthTxs.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const expensesMonth = monthTxs.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const prevMonthTxs = txs.filter((t) => getTransactionBusinessDate(t, appointmentDates).startsWith(prevYm));
  const prevRevenue = prevMonthTxs.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);

  const monthApts = apts.filter((a) => (a.appointment_date ?? "").startsWith(ym));
  const completedMonth = monthApts.filter((a) => a.status === "concluido").length;
  const pendingAppointments = monthApts.filter((a) => !["concluido", "cancelado"].includes(a.status)).length;
  const vehiclesServiced = new Set(
    monthApts.filter((a) => a.status === "concluido").map((a) => a.vehicle_id)
  ).size;
  const newCustomers = (customers as any[]).filter((c) => (c.created_at ?? "").startsWith(ym)).length;
  const lowStock = (products as any[]).filter((p) => Number(p.stock) <= Number(p.minimum_stock)).length;
  const unreadNotifications = (notifications as any[]).filter((n) => Number(n.read ?? 0) === 0).length;

  const averageTicket = completedMonth > 0 ? revenueMonth / completedMonth : 0;
  const revenueGrowth = prevRevenue > 0 ? ((revenueMonth - prevRevenue) / prevRevenue) * 100 : 0;

  res.json({
    monthlyRevenue: revenueMonth,
    monthlyProfit: revenueMonth - expensesMonth,
    averageTicket,
    totalAppointments: monthApts.length,
    completedAppointments: completedMonth,
    vehiclesServiced,
    newCustomers,
    pendingAppointments,
    lowStockProducts: lowStock,
    unreadNotifications,
    revenueGrowth,
  });
});

// GET /dashboard/revenue-by-day  (daily revenue for a month)
router.get("/revenue-by-day", async (req, res) => {
  const now = new Date();
  const monthParam = Number(req.query.month);
  const yearParam = Number(req.query.year);
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : now.getFullYear();
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const ym = `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}`;

  const [txs, appointments] = await Promise.all([
    getAll("financial_transactions"),
    getAll("appointments"),
  ]) as [any[], any[]];
  const appointmentDates = new Map(
    appointments.map((appointment) => [Number(appointment.id), appointment.appointment_date]),
  );
  const monthTxs = txs.filter((t) => getTransactionBusinessDate(t, appointmentDates).startsWith(ym));
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyMap: Record<string, number> = {};

  for (const t of monthTxs) {
    if (t.type !== "receita") continue;
    const date = getTransactionBusinessDate(t, appointmentDates);
    dailyMap[date] = (dailyMap[date] ?? 0) + Number(t.amount);
  }

  const result = Array.from({ length: daysInMonth }, (_v, i) => {
    const day = String(i + 1).padStart(2, "0");
    const date = `${ym}-${day}`;
    return { date, revenue: dailyMap[date] ?? 0, appointments: 0 };
  });

  res.json(result);
});

// GET /dashboard/top-services
router.get("/top-services", async (_req, res) => {
  const [aptSvcs, appointments, services] = await Promise.all([
    getAll("appointment_services"),
    getAll("appointments"),
    getAll("services"),
  ]);
  const completedAptIds = new Set(
    (appointments as any[])
      .filter((a) => a.status === "concluido")
      .map((a) => a.id)
  );
  const svcMap = new Map((services as any[]).map((s: any) => [s.id, s]));
  const counts: Record<number, { serviceName: string; count: number; revenue: number }> = {};

  for (const as_ of aptSvcs as any[]) {
    if (!completedAptIds.has(as_.appointment_id)) continue;
    const sid = as_.service_id;
    const svc = svcMap.get(sid) as any;
    if (!svc) continue;
    if (!counts[sid]) counts[sid] = { serviceName: svc.name, count: 0, revenue: 0 };
    counts[sid].count += 1;
    counts[sid].revenue += Number(svc.price ?? 0);
  }

  const result = Object.values(counts)
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
    .slice(0, 5);
  res.json(result);
});

// GET /dashboard/top-customers
router.get("/top-customers", async (_req, res) => {
  const customers = await getAll("customers") as any[];
  const top = customers
    .sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))
    .slice(0, 5)
    .map((c) => ({
      id: c.id, name: c.name, phone: c.phone,
      totalSpent: Number(c.total_spent ?? 0), totalServices: Number(c.total_services ?? 0),
    }));
  res.json(top);
});

// GET /dashboard/upcoming-appointments  (next 7 days)
router.get("/upcoming-appointments", async (_req, res) => {
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let apts = await getAll("appointments") as any[];
  apts = apts.filter((a) =>
    (a.appointment_date ?? "") >= start &&
    (a.appointment_date ?? "") <= end &&
    a.status === "agendado"
  );
  apts.sort((a, b) => (a.appointment_date ?? "").localeCompare(b.appointment_date ?? ""));
  const customers = await getAll("customers");
  const vehicles = await getAll("vehicles");
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  const vehMap = new Map((vehicles as any[]).map((v: any) => [v.id, v]));
  res.json(apts.slice(0, 10).map((a) => {
    const c = custMap.get(a.customer_id) as any;
    const v = vehMap.get(a.vehicle_id) as any;
    return {
      id: a.id, appointmentDate: a.appointment_date, status: a.status,
      finalPrice: Number(a.final_price),
      customer: c ? { id: c.id, name: c.name, phone: c.phone } : undefined,
      vehicle: v ? { id: v.id, brand: v.brand, model: v.model, plate: v.plate } : undefined,
    };
  }));
});

// GET /dashboard/customers-needing-service
router.get("/customers-needing-service", async (req, res) => {
  const now = new Date();
  const daysParam = Number(req.query.days);
  const limitParam = Number(req.query.limit);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 10;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const customers = await getAll("customers") as any[];
  const filtered = customers
    .filter((c) => {
      if (!c.last_service_date) return false;
      return new Date(c.last_service_date) <= cutoff;
    })
    .sort((a, b) => (a.last_service_date ?? "").localeCompare(b.last_service_date ?? ""))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      whatsapp: c.whatsapp,
      email: c.email,
      address: c.address,
      notes: c.notes,
      totalSpent: Number(c.total_spent ?? 0),
      totalServices: Number(c.total_services ?? 0),
      lastServiceDate: c.last_service_date,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

  res.json(filtered);
});

// GET /dashboard/status-counts
router.get("/status-counts", async (_req, res) => {
  const apts = await getAll("appointments") as any[];
  const counts: Record<string, number> = {};
  for (const a of apts) { counts[a.status] = (counts[a.status] ?? 0) + 1; }
  res.json(counts);
});

export default router;
