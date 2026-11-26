import { Router } from "express";
import { db, getAll } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// GET /dashboard/kpis
router.get("/kpis", async (_req, res) => {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7); // "YYYY-MM"
  const todayStr = now.toISOString().slice(0, 10);
  const [appointments, transactions, customers, products] = await Promise.all([
    getAll("appointments"),
    getAll("financial_transactions"),
    getAll("customers"),
    getAll("products"),
  ]);
  const apts = appointments as any[];
  const txs = transactions as any[];
  const monthTxs = txs.filter((t) => (t.date ?? "").startsWith(ym));
  const revenueMonth = monthTxs.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const expensesMonth = monthTxs.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const monthApts = apts.filter((a) => (a.appointment_date ?? "").startsWith(ym));
  const completedMonth = monthApts.filter((a) => a.status === "concluido").length;
  const todayApts = apts.filter((a) => (a.appointment_date ?? "").startsWith(todayStr));
  const scheduledToday = todayApts.filter((a) => a.status === "agendado").length;
  const inProgress = apts.filter((a) => a.status === "em_andamento").length;
  const lowStock = (products as any[]).filter((p) => Number(p.stock) <= Number(p.minimum_stock)).length;
  res.json({
    revenueThisMonth: revenueMonth,
    expensesThisMonth: expensesMonth,
    netThisMonth: revenueMonth - expensesMonth,
    totalAppointmentsThisMonth: monthApts.length,
    completedThisMonth: completedMonth,
    scheduledToday,
    inProgress,
    totalCustomers: (customers as any[]).length,
    lowStockProducts: lowStock,
  });
});

// GET /dashboard/revenue-chart  (last 6 months)
router.get("/revenue-chart", async (_req, res) => {
  const txs = await getAll("financial_transactions") as any[];
  // build last 6 months list
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  const byMonth: Record<string, { revenue: number; expenses: number }> = {};
  for (const m of months) byMonth[m] = { revenue: 0, expenses: 0 };
  for (const t of txs) {
    const m = (t.date ?? "").slice(0, 7);
    if (byMonth[m]) {
      if (t.type === "receita") byMonth[m].revenue += Number(t.amount);
      else byMonth[m].expenses += Number(t.amount);
    }
  }
  res.json(months.map((m) => ({
    month: m,
    revenue: byMonth[m].revenue,
    expenses: byMonth[m].expenses,
    net: byMonth[m].revenue - byMonth[m].expenses,
  })));
});

// GET /dashboard/top-services
router.get("/top-services", async (_req, res) => {
  const [aptSvcs, services] = await Promise.all([
    getAll("appointment_services"),
    getAll("services"),
  ]);
  const svcMap = new Map((services as any[]).map((s: any) => [s.id, s]));
  const counts: Record<number, { name: string; count: number; revenue: number }> = {};
  for (const as_ of aptSvcs as any[]) {
    const sid = as_.service_id;
    const svc = svcMap.get(sid) as any;
    if (!counts[sid]) counts[sid] = { name: svc?.name ?? String(sid), count: 0, revenue: 0 };
    counts[sid].count++;
    counts[sid].revenue += Number(svc?.price ?? 0);
  }
  const result = Object.entries(counts)
    .map(([id, v]) => ({ serviceId: Number(id), ...v }))
    .sort((a, b) => b.count - a.count)
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

// GET /dashboard/upcoming  (next 7 days)
router.get("/upcoming", async (_req, res) => {
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

// GET /dashboard/status-counts
router.get("/status-counts", async (_req, res) => {
  const apts = await getAll("appointments") as any[];
  const counts: Record<string, number> = {};
  for (const a of apts) { counts[a.status] = (counts[a.status] ?? 0) + 1; }
  res.json(counts);
});

export default router;
