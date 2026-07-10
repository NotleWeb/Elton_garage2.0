import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/monthly", (req, res) => {
  const { month, year } = req.query as any;
  if (!month || !year) { res.status(400).json({ error: "validation", message: "Mês e ano são obrigatórios" }); return; }
  const m = Number(month); const y = Number(year);
  const prefix = `${y}-${String(m).padStart(2, "0")}`;

  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE ?").get(`${prefix}%`) as any).s;
  const totalExpenses = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE ?").get(`${prefix}%`) as any).s;
  const totalAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE appointment_date LIKE ?").get(`${prefix}%`) as any).c;
  const completedAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE ?").get(`${prefix}%`) as any).c;
  const cancelledAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='cancelado' AND appointment_date LIKE ?").get(`${prefix}%`) as any).c;
  const newCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE created_at LIKE ?").get(`${prefix}%`) as any).c;

  // Top services: count individual service occurrences across all completed appointments
  const topServices = db.prepare(`
    SELECT s.id as serviceId, s.name as serviceName, COUNT(*) as count,
      COALESCE(SUM(
        a.final_price * 1.0 / NULLIF((SELECT COUNT(*) FROM appointment_services aps2 WHERE aps2.appointment_id = a.id), 0)
      ), 0) as revenue
    FROM appointments a
    JOIN appointment_services aps ON aps.appointment_id = a.id
    JOIN services s ON s.id = aps.service_id
    WHERE a.status='concluido' AND a.appointment_date LIKE ?
    GROUP BY s.id
    ORDER BY count DESC
    LIMIT 5
  `).all(`${prefix}%`) as any[];

  const revenueByDay = db.prepare(
    "SELECT date, SUM(amount) as revenue, COUNT(*) as appointments FROM financial_transactions WHERE type='receita' AND date LIKE ? GROUP BY date ORDER BY date"
  ).all(`${prefix}%`) as any[];

  res.json({
    month: m, year: y, totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses,
    totalAppointments, completedAppointments, cancelledAppointments, newCustomers,
    topServices: topServices.map(s => ({ serviceId: s.serviceId, serviceName: s.serviceName, count: s.count, revenue: s.revenue })),
    revenueByDay: revenueByDay.map(r => ({ date: r.date, revenue: r.revenue, appointments: r.appointments })),
  });
});

router.get("/services", (req, res) => {
  const { dateFrom, dateTo } = req.query as any;
  let aptWhere = "WHERE 1=1";
  const params: any[] = [];
  if (dateFrom) { aptWhere += " AND a.appointment_date >= ?"; params.push(dateFrom); }
  if (dateTo) { aptWhere += " AND a.appointment_date <= ?"; params.push(dateTo + "T23:59:59"); }
  const fromStr = dateFrom ?? "inicio";
  const toStr = dateTo ?? "hoje";

  // Total services = count of individual service instances (not appointments)
  const totalServices = (db.prepare(`
    SELECT COUNT(*) as c FROM appointments a
    JOIN appointment_services aps ON aps.appointment_id = a.id
    ${aptWhere}
  `).get(...params) as any).c;

  // Use the same aptWhere/params built above (with AND a.status='concluido' added)
  const revWhere = aptWhere + " AND a.status='concluido'";
  const totalRevenue = (db.prepare(`SELECT COALESCE(SUM(final_price),0) as s FROM appointments a ${revWhere}`).get(...params) as any).s;

  // By category: count individual service occurrences
  const byCategory = db.prepare(`
    SELECT s.category, COUNT(*) as count,
      COALESCE(SUM(
        a.final_price * 1.0 / NULLIF((SELECT COUNT(*) FROM appointment_services aps2 WHERE aps2.appointment_id = a.id), 0)
      ), 0) as revenue
    FROM appointments a
    JOIN appointment_services aps ON aps.appointment_id = a.id
    JOIN services s ON s.id = aps.service_id
    ${aptWhere}
    GROUP BY s.category ORDER BY count DESC
  `).all(...params) as any[];

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM appointments a ${aptWhere} GROUP BY status
  `).all(...params) as any[];

  res.json({
    dateFrom: fromStr, dateTo: toStr, totalServices, totalRevenue,
    byCategory: byCategory.map((c: any) => ({ category: c.category ?? "Sem categoria", count: c.count, revenue: c.revenue })),
    byStatus: byStatus.map((s: any) => ({ status: s.status, count: s.count })),
  });
});

export default router;
