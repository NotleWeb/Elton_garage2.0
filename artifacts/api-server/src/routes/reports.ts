import { Router } from "express";
import { db, getAll } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// GET /reports/monthly?year=YYYY
router.get("/monthly", async (req, res) => {
  const { year } = req.query as any;
  const txs = await getAll("financial_transactions") as any[];
  const filtered = year ? txs.filter((t) => (t.date ?? "").startsWith(String(year))) : txs;
  const byMonth: Record<string, { revenue: number; expenses: number; count: number }> = {};
  for (const t of filtered) {
    const m = (t.date ?? "").slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { revenue: 0, expenses: 0, count: 0 };
    byMonth[m].count++;
    if (t.type === "receita") byMonth[m].revenue += Number(t.amount);
    else byMonth[m].expenses += Number(t.amount);
  }
  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, expenses: v.expenses, net: v.revenue - v.expenses, transactions: v.count }));
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  res.json({ data: rows, summary: { totalRevenue, totalExpenses, net: totalRevenue - totalExpenses } });
});

// GET /reports/services?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get("/services", async (req, res) => {
  const { startDate, endDate } = req.query as any;
  let apts = await getAll("appointments") as any[];
  if (startDate) apts = apts.filter((a) => (a.appointment_date ?? "") >= startDate);
  if (endDate) apts = apts.filter((a) => (a.appointment_date ?? "") <= endDate + "T23:59:59");
  const aptIds = new Set(apts.map((a) => a.id));
  const [aptSvcs, services] = await Promise.all([
    getAll("appointment_services"),
    getAll("services"),
  ]);
  const svcMap = new Map((services as any[]).map((s: any) => [s.id, s]));
  const counts: Record<number, { name: string; category: string; count: number; revenue: number }> = {};
  for (const as_ of aptSvcs as any[]) {
    if (!aptIds.has(as_.appointment_id)) continue;
    const sid = as_.service_id;
    const svc = svcMap.get(sid) as any;
    if (!counts[sid]) counts[sid] = { name: svc?.name ?? String(sid), category: svc?.category ?? "", count: 0, revenue: 0 };
    counts[sid].count++;
    counts[sid].revenue += Number(svc?.price ?? 0);
  }
  const result = Object.entries(counts)
    .map(([id, v]) => ({ serviceId: Number(id), ...v }))
    .sort((a, b) => b.count - a.count);
  res.json({ data: result, totalServices: result.reduce((s, r) => s + r.count, 0), totalRevenue: result.reduce((s, r) => s + r.revenue, 0) });
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
