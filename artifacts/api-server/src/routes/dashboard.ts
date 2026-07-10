import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function getPeriodFilter(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  const monthStr = String(m).padStart(2, "0");
  return { prefix: `${y}-${monthStr}`, month: m, year: y };
}

/** Load services for multiple appointment IDs, returns Map<appointmentId, services[]> */
function loadServicesMap(appointmentIds: number[]): Map<number, any[]> {
  if (!appointmentIds.length) return new Map();
  const placeholders = appointmentIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT aps.appointment_id, s.id, s.name, s.price, s.estimated_duration, s.category
    FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id IN (${placeholders})
  `).all(...appointmentIds) as any[];
  const map = new Map<number, any[]>();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) map.set(row.appointment_id, []);
    map.get(row.appointment_id)!.push({
      id: row.id, name: row.name, price: row.price,
      estimatedDuration: row.estimated_duration, category: row.category,
    });
  }
  return map;
}

function mapAppointmentDetail(a: any, services: any[]) {
  const totalDuration = services.reduce((s, sv) => s + (sv.estimatedDuration || 0), 0);
  return {
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id,
    serviceIds: services.map((s) => s.id),
    appointmentDate: a.appointment_date, status: a.status, discount: a.discount ?? 0,
    finalPrice: a.final_price, totalDuration, observations: a.observations, createdAt: a.created_at,
    customer: { id: a.cid, name: a.cname, phone: a.cphone, email: a.cemail, totalSpent: a.ctotal_spent, totalServices: a.ctotal_services, createdAt: a.ccreated_at, updatedAt: a.cupdated_at },
    vehicle: { id: a.vid, customerId: a.customer_id, brand: a.vbrand, model: a.vmodel, plate: a.vplate, color: a.vcolor, fuel: a.vfuel, year: a.vyear },
    services,
  };
}

router.get("/kpis", (req, res) => {
  const { month, year } = req.query as any;
  const { prefix, month: m, year: y } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);

  // Previous month for growth calculation
  const prevDate = new Date(y, m - 2, 1);
  const prevM = prevDate.getMonth() + 1;
  const prevY = prevDate.getFullYear();
  const prevPrefix = `${prevY}-${String(prevM).padStart(2, "0")}`;

  const monthlyRevenue = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE ?").get(`${prefix}%`) as any).s;
  const monthlyExpenses = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE ?").get(`${prefix}%`) as any).s;
  const prevRevenue = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE ?").get(`${prevPrefix}%`) as any).s;
  const revenueGrowth = prevRevenue > 0 ? ((monthlyRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const totalAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE appointment_date LIKE ?").get(`${prefix}%`) as any).c;
  const completedAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE ?").get(`${prefix}%`) as any).c;
  const pendingAppointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status IN ('agendado','confirmado','em_andamento')").get() as any).c;
  const vehiclesServiced = (db.prepare("SELECT COUNT(DISTINCT vehicle_id) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE ?").get(`${prefix}%`) as any).c;

  // Hours worked: sum estimated_duration from appointment_services for completed appointments
  const svcDurations = db.prepare(`
    SELECT s.estimated_duration
    FROM appointments a
    JOIN appointment_services aps ON aps.appointment_id = a.id
    JOIN services s ON s.id = aps.service_id
    WHERE a.status='concluido' AND a.appointment_date LIKE ?
  `).all(`${prefix}%`) as any[];
  const hoursWorked = svcDurations.reduce((sum, s) => sum + (s.estimated_duration || 0), 0) / 60;

  const avgTicket = completedAppointments > 0 ? monthlyRevenue / completedAppointments : 0;
  const newCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE created_at LIKE ?").get(`${prefix}%`) as any).c;
  const lowStockProducts = (db.prepare("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock").get() as any).c;
  const unreadNotifications = (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE read = 0").get() as any).c;

  res.json({ monthlyRevenue, monthlyProfit: monthlyRevenue - monthlyExpenses, averageTicket: avgTicket, totalAppointments, completedAppointments, vehiclesServiced, hoursWorked, newCustomers, pendingAppointments, lowStockProducts, unreadNotifications, revenueGrowth });
});

router.get("/revenue-by-day", (req, res) => {
  const { month, year } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const rows = db.prepare("SELECT date, SUM(amount) as revenue, COUNT(*) as appointments FROM financial_transactions WHERE type='receita' AND date LIKE ? GROUP BY date ORDER BY date").all(`${prefix}%`) as any[];
  res.json(rows.map(r => ({ date: r.date, revenue: r.revenue, appointments: r.appointments })));
});

router.get("/revenue-by-month", (req, res) => {
  const { year } = req.query as any;
  const y = year ? Number(year) : new Date().getFullYear();
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const revenue = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE ?").get(`${prefix}%`) as any).s;
    const expenses = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE ?").get(`${prefix}%`) as any).s;
    const appointments = (db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE ?").get(`${prefix}%`) as any).c;
    months.push({ month: m, year: y, revenue, expenses, profit: revenue - expenses, appointments });
  }
  res.json(months);
});

router.get("/top-services", (req, res) => {
  const { month, year, limit = 5 } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  // Count each service occurrence across appointments; distribute revenue proportionally
  const rows = db.prepare(`
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
    LIMIT ?
  `).all(`${prefix}%`, Number(limit)) as any[];
  res.json(rows.map(r => ({ serviceId: r.serviceId, serviceName: r.serviceName, count: r.count, revenue: r.revenue })));
});

router.get("/top-customers", (req, res) => {
  const { month, year, limit = 5 } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const rows = db.prepare(`
    SELECT c.id as customerId, c.name as customerName, COALESCE(SUM(a.final_price), 0) as totalSpent, COUNT(*) as totalServices
    FROM appointments a JOIN customers c ON c.id = a.customer_id
    WHERE a.status='concluido' AND a.appointment_date LIKE ?
    GROUP BY c.id ORDER BY totalSpent DESC LIMIT ?
  `).all(`${prefix}%`, Number(limit)) as any[];
  res.json(rows.map(r => ({ customerId: r.customerId, customerName: r.customerName, totalSpent: r.totalSpent, totalServices: r.totalServices })));
});

router.get("/upcoming-appointments", (req, res) => {
  const { limit = 10 } = req.query as any;
  const now = new Date().toISOString();
  const rows = db.prepare(`
    SELECT a.*,
      c.id as cid, c.name as cname, c.phone as cphone, c.email as cemail, c.total_spent as ctotal_spent, c.total_services as ctotal_services, c.created_at as ccreated_at, c.updated_at as cupdated_at,
      v.id as vid, v.brand as vbrand, v.model as vmodel, v.plate as vplate, v.color as vcolor, v.fuel as vfuel, v.year as vyear
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    WHERE a.appointment_date >= ? AND a.status IN ('agendado','confirmado')
    ORDER BY a.appointment_date ASC LIMIT ?
  `).all(now, Number(limit)) as any[];

  const ids = rows.map((r) => r.id);
  const svcMap = loadServicesMap(ids);
  res.json(rows.map((r) => mapAppointmentDetail(r, svcMap.get(r.id) || [])));
});

router.get("/customers-needing-service", (req, res) => {
  const { days = 30, limit = 10 } = req.query as any;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(days));
  const rows = db.prepare(`
    SELECT * FROM customers WHERE (last_service_date IS NOT NULL AND last_service_date < ?) OR (last_service_date IS NULL AND created_at < ?) ORDER BY last_service_date ASC LIMIT ?
  `).all(cutoff.toISOString(), cutoff.toISOString(), Number(limit)) as any[];
  res.json(rows.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp, email: c.email, totalSpent: c.total_spent, totalServices: c.total_services, lastServiceDate: c.last_service_date, createdAt: c.created_at, updatedAt: c.updated_at })));
});

export default router;
