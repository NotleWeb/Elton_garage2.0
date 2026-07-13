import { Router } from "express";
import { db, getAll } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const toDate = (value: any): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inRange = (value: any, start: Date | null, end: Date | null): boolean => {
  const d = toDate(value);
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
};

const dayKey = (value: any): string | null => {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
};

// GET /reports/monthly?month=M&year=YYYY
router.get("/monthly", async (req, res) => {
  const now = new Date();
  const monthParam = Number((req.query as any).month);
  const yearParam = Number((req.query as any).year);
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : now.getFullYear();

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const monthPrefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

  const [txs, appointments, customers, appointmentServices, services] = await Promise.all([
    getAll("financial_transactions") as Promise<any[]>,
    getAll("appointments") as Promise<any[]>,
    getAll("customers") as Promise<any[]>,
    getAll("appointment_services") as Promise<any[]>,
    getAll("services") as Promise<any[]>,
  ]);

  const monthTxs = txs.filter((t) => inRange(t.date, monthStart, monthEnd));
  const totalRevenue = monthTxs
    .filter((t) => t.type === "receita")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalExpenses = monthTxs
    .filter((t) => t.type === "despesa")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const monthAppointments = appointments.filter((a) => inRange(a.appointment_date ?? a.date, monthStart, monthEnd));
  const completedAppointments = monthAppointments.filter((a) => a.status === "concluido" || a.status === "completed");
  const cancelledAppointments = monthAppointments.filter((a) => a.status === "cancelado" || a.status === "cancelled");

  const newCustomers = customers.filter((c) => {
    const created = c.createdAt ?? c.created_at;
    return inRange(created, monthStart, monthEnd);
  }).length;

  const dayRevenueMap: Record<string, number> = {};
  for (const t of monthTxs) {
    if (t.type !== "receita") continue;
    const key = dayKey(t.date);
    if (!key) continue;
    dayRevenueMap[key] = (dayRevenueMap[key] ?? 0) + Number(t.amount ?? 0);
  }

  const dayAppointmentsMap: Record<string, number> = {};
  for (const a of monthAppointments) {
    const key = dayKey(a.appointment_date ?? a.date);
    if (!key) continue;
    dayAppointmentsMap[key] = (dayAppointmentsMap[key] ?? 0) + 1;
  }

  const dayKeys = Array.from(new Set([...Object.keys(dayRevenueMap), ...Object.keys(dayAppointmentsMap)])).sort((a, b) => a.localeCompare(b));
  const revenueByDay = dayKeys.map((date) => ({
    date,
    revenue: dayRevenueMap[date] ?? 0,
    appointments: dayAppointmentsMap[date] ?? 0,
  }));

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const completedIds = new Set(completedAppointments.map((a) => a.id));
  const topServiceAcc: Record<number, { serviceId: number; serviceName: string; count: number; revenue: number }> = {};

  for (const row of appointmentServices) {
    if (!completedIds.has(row.appointment_id)) continue;
    const svc = serviceMap.get(row.service_id);
    const id = Number(row.service_id);
    if (!topServiceAcc[id]) {
      topServiceAcc[id] = {
        serviceId: id,
        serviceName: String(svc?.name ?? `Serviço ${id}`),
        count: 0,
        revenue: 0,
      };
    }

    const price = Number(row.price ?? svc?.price ?? 0);
    topServiceAcc[id].count += 1;
    topServiceAcc[id].revenue += price;
  }

  const topServices = Object.values(topServiceAcc).sort((a, b) => b.revenue - a.revenue);

  res.json({
    month,
    year,
    totalRevenue,
    totalExpenses,
    profit: totalRevenue - totalExpenses,
    totalAppointments: monthAppointments.length,
    completedAppointments: completedAppointments.length,
    cancelledAppointments: cancelledAppointments.length,
    newCustomers,
    topServices,
    revenueByDay,
  });
});

// GET /reports/services?dateFrom=ISO&dateTo=ISO
router.get("/services", async (req, res) => {
  const { dateFrom, dateTo, startDate, endDate } = req.query as any;
  const start = toDate(dateFrom ?? startDate);
  const end = toDate(dateTo ?? endDate);

  const [appointments, aptSvcs, services] = await Promise.all([
    getAll("appointments") as Promise<any[]>,
    getAll("appointment_services") as Promise<any[]>,
    getAll("services") as Promise<any[]>,
  ]);

  const filteredApts = appointments.filter((a) => inRange(a.appointment_date ?? a.date, start, end));
  const aptIds = new Set(filteredApts.map((a) => a.id));
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const byCategory: Record<string, { category: string; count: number; revenue: number }> = {};
  const byStatus: Record<string, { status: string; count: number }> = {};
  let totalServices = 0;
  let totalRevenue = 0;

  for (const apt of filteredApts) {
    const status = String(apt.status ?? "desconhecido");
    if (!byStatus[status]) byStatus[status] = { status, count: 0 };
    byStatus[status].count += 1;
  }

  for (const row of aptSvcs) {
    if (!aptIds.has(row.appointment_id)) continue;
    const svc = serviceMap.get(row.service_id);
    const category = String(svc?.category ?? "Sem categoria");
    const price = Number(row.price ?? svc?.price ?? 0);

    if (!byCategory[category]) {
      byCategory[category] = { category, count: 0, revenue: 0 };
    }

    byCategory[category].count += 1;
    byCategory[category].revenue += price;
    totalServices += 1;
    totalRevenue += price;
  }

  res.json({
    dateFrom: start ? start.toISOString() : null,
    dateTo: end ? end.toISOString() : null,
    totalServices,
    totalRevenue,
    byCategory: Object.values(byCategory).sort((a, b) => b.revenue - a.revenue),
    byStatus: Object.values(byStatus).sort((a, b) => b.count - a.count),
  });
});

// GET /reports/customers?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get("/customers", async (req, res) => {
  const { startDate, endDate } = req.query as any;
  let apts = await getAll("appointments") as any[];
  if (startDate) apts = apts.filter((a) => (a.appointment_date ?? "") >= startDate);
  if (endDate) apts = apts.filter((a) => (a.appointment_date ?? "") <= endDate + "T23:59:59");
  const completed = apts.filter((a) => a.status === "concluido");
  const customers = await getAll("customers") as any[];
  const custMap = new Map(customers.map((c: any) => [c.id, c]));
  const byCust: Record<number, { name: string; appointments: number; revenue: number }> = {};
  for (const a of completed) {
    const cid = a.customer_id;
    const c = custMap.get(cid) as any;
    if (!byCust[cid]) byCust[cid] = { name: c?.name ?? String(cid), appointments: 0, revenue: 0 };
    byCust[cid].appointments++;
    byCust[cid].revenue += Number(a.final_price ?? 0);
  }
  const result = Object.entries(byCust)
    .map(([id, v]) => ({ customerId: Number(id), ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  res.json({ data: result });
});

export default router;
