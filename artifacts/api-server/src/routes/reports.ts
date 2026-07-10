import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/monthly", async (req, res) => {
  const { month, year } = req.query as any;
  if (!month || !year) { res.status(400).json({ error: "validation", message: "Mês e ano são obrigatórios" }); return; }
  const m = Number(month); const y = Number(year);
  const prefix = `${y}-${String(m).padStart(2, "0")}`;

  const [revRow, expRow, totalAptRow, completedRow, cancelledRow, newCustRow, topServices, revenueByDay] = await Promise.all([
    db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE appointment_date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE status='cancelado' AND appointment_date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM customers WHERE created_at LIKE $1", [`${prefix}%`]),
    db.all(`
      SELECT s.id as serviceId, s.name as serviceName, COUNT(*) as count,
        COALESCE(SUM(
          a.final_price * 1.0 / NULLIF((SELECT COUNT(*) FROM appointment_services aps2 WHERE aps2.appointment_id = a.id), 0)
        ), 0) as revenue
      FROM appointments a
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services s ON s.id = aps.service_id
      WHERE a.status='concluido' AND a.appointment_date LIKE $1
      GROUP BY s.id, s.name ORDER BY count DESC LIMIT 5
    `, [`${prefix}%`]),
    db.all("SELECT date, SUM(amount) as revenue, COUNT(*) as appointments FROM financial_transactions WHERE type='receita' AND date LIKE $1 GROUP BY date ORDER BY date", [`${prefix}%`]),
  ]);

  const totalRevenue = Number((revRow as any)?.s ?? 0);
  const totalExpenses = Number((expRow as any)?.s ?? 0);

  res.json({
    month: m, year: y, totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses,
    totalAppointments: Number((totalAptRow as any)?.c ?? 0),
    completedAppointments: Number((completedRow as any)?.c ?? 0),
    cancelledAppointments: Number((cancelledRow as any)?.c ?? 0),
    newCustomers: Number((newCustRow as any)?.c ?? 0),
    topServices: (topServices as any[]).map(s => ({ serviceId: s.serviceid, serviceName: s.servicename, count: Number(s.count), revenue: Number(s.revenue) })),
    revenueByDay: (revenueByDay as any[]).map(r => ({ date: r.date, revenue: Number(r.revenue), appointments: Number(r.appointments) })),
  });
});

router.get("/services", async (req, res) => {
  const { dateFrom, dateTo } = req.query as any;
  let aptWhere = "WHERE 1=1";
  const params: any[] = [];
  if (dateFrom) { aptWhere += ` AND a.appointment_date >= $${params.length + 1}`; params.push(dateFrom); }
  if (dateTo) { aptWhere += ` AND a.appointment_date <= $${params.length + 1}`; params.push(dateTo + "T23:59:59"); }

  const revWhere = aptWhere + " AND a.status='concluido'";

  const [totalSvcRow, totalRevRow, byCategory, byStatus] = await Promise.all([
    db.get(`SELECT COUNT(*) as c FROM appointments a JOIN appointment_services aps ON aps.appointment_id = a.id ${aptWhere}`, params),
    db.get(`SELECT COALESCE(SUM(final_price),0) as s FROM appointments a ${revWhere}`, params),
    db.all(`
      SELECT s.category, COUNT(*) as count,
        COALESCE(SUM(
          a.final_price * 1.0 / NULLIF((SELECT COUNT(*) FROM appointment_services aps2 WHERE aps2.appointment_id = a.id), 0)
        ), 0) as revenue
      FROM appointments a
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services s ON s.id = aps.service_id
      ${aptWhere}
      GROUP BY s.category ORDER BY count DESC
    `, params),
    db.all(`SELECT status, COUNT(*) as count FROM appointments a ${aptWhere} GROUP BY status`, params),
  ]);

  res.json({
    dateFrom: dateFrom ?? "inicio", dateTo: dateTo ?? "hoje",
    totalServices: Number((totalSvcRow as any)?.c ?? 0),
    totalRevenue: Number((totalRevRow as any)?.s ?? 0),
    byCategory: (byCategory as any[]).map((c: any) => ({ category: c.category ?? "Sem categoria", count: Number(c.count), revenue: Number(c.revenue) })),
    byStatus: (byStatus as any[]).map((s: any) => ({ status: s.status, count: Number(s.count) })),
  });
});

export default router;
