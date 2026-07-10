import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function getPeriodFilter(month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  return { prefix: `${y}-${String(m).padStart(2, "0")}`, month: m, year: y };
}

async function loadServicesMap(appointmentIds: number[]): Promise<Map<number, any[]>> {
  if (!appointmentIds.length) return new Map();
  const rows = await db.all(`
    SELECT aps.appointment_id, s.id, s.name, s.price, s.estimated_duration, s.category
    FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ANY($1::int[])
  `, [appointmentIds]) as any[];
  const map = new Map<number, any[]>();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) map.set(row.appointment_id, []);
    map.get(row.appointment_id)!.push({ id: row.id, name: row.name, price: Number(row.price), estimatedDuration: row.estimated_duration, category: row.category });
  }
  return map;
}

function mapAppointmentDetail(a: any, services: any[]) {
  const totalDuration = services.reduce((s, sv) => s + (sv.estimatedDuration || 0), 0);
  return {
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id,
    serviceIds: services.map((s) => s.id),
    appointmentDate: a.appointment_date, status: a.status, discount: Number(a.discount ?? 0),
    finalPrice: Number(a.final_price), totalDuration, observations: a.observations, createdAt: a.created_at,
    customer: { id: a.cid, name: a.cname, phone: a.cphone, email: a.cemail, totalSpent: Number(a.ctotal_spent), totalServices: a.ctotal_services, createdAt: a.ccreated_at, updatedAt: a.cupdated_at },
    vehicle: { id: a.vid, customerId: a.customer_id, brand: a.vbrand, model: a.vmodel, plate: a.vplate, color: a.vcolor, fuel: a.vfuel, year: a.vyear },
    services,
  };
}

router.get("/kpis", async (req, res) => {
  const { month, year } = req.query as any;
  const { prefix, month: m, year: y } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const prevDate = new Date(y, m - 2, 1);
  const prevM = prevDate.getMonth() + 1;
  const prevY = prevDate.getFullYear();
  const prevPrefix = `${prevY}-${String(prevM).padStart(2, "0")}`;

  const [
    revRow, expRow, prevRevRow,
    totalAptRow, completedAptRow, pendingAptRow, vehiclesRow,
    svcDurations, newCustRow, lowStockRow, unreadRow
  ] = await Promise.all([
    db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE $1", [`${prevPrefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE appointment_date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM appointments WHERE status IN ('agendado','confirmado','em_andamento')"),
    db.get("SELECT COUNT(DISTINCT vehicle_id) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE $1", [`${prefix}%`]),
    db.all(`SELECT s.estimated_duration FROM appointments a JOIN appointment_services aps ON aps.appointment_id = a.id JOIN services s ON s.id = aps.service_id WHERE a.status='concluido' AND a.appointment_date LIKE $1`, [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM customers WHERE created_at LIKE $1", [`${prefix}%`]),
    db.get("SELECT COUNT(*) as c FROM products WHERE stock <= minimum_stock"),
    db.get("SELECT COUNT(*) as c FROM notifications WHERE read = 0"),
  ]);

  const monthlyRevenue = Number((revRow as any)?.s ?? 0);
  const monthlyExpenses = Number((expRow as any)?.s ?? 0);
  const prevRevenue = Number((prevRevRow as any)?.s ?? 0);
  const revenueGrowth = prevRevenue > 0 ? ((monthlyRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const totalAppointments = Number((totalAptRow as any)?.c ?? 0);
  const completedAppointments = Number((completedAptRow as any)?.c ?? 0);
  const pendingAppointments = Number((pendingAptRow as any)?.c ?? 0);
  const vehiclesServiced = Number((vehiclesRow as any)?.c ?? 0);
  const hoursWorked = (svcDurations as any[]).reduce((sum, s) => sum + (s.estimated_duration || 0), 0) / 60;
  const avgTicket = completedAppointments > 0 ? monthlyRevenue / completedAppointments : 0;
  const newCustomers = Number((newCustRow as any)?.c ?? 0);
  const lowStockProducts = Number((lowStockRow as any)?.c ?? 0);
  const unreadNotifications = Number((unreadRow as any)?.c ?? 0);

  res.json({ monthlyRevenue, monthlyProfit: monthlyRevenue - monthlyExpenses, averageTicket: avgTicket, totalAppointments, completedAppointments, vehiclesServiced, hoursWorked, newCustomers, pendingAppointments, lowStockProducts, unreadNotifications, revenueGrowth });
});

router.get("/revenue-by-day", async (req, res) => {
  const { month, year } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const rows = await db.all("SELECT date, SUM(amount) as revenue, COUNT(*) as appointments FROM financial_transactions WHERE type='receita' AND date LIKE $1 GROUP BY date ORDER BY date", [`${prefix}%`]) as any[];
  res.json(rows.map(r => ({ date: r.date, revenue: Number(r.revenue), appointments: Number(r.appointments) })));
});

router.get("/revenue-by-month", async (req, res) => {
  const { year } = req.query as any;
  const y = year ? Number(year) : new Date().getFullYear();
  const months = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const mo = i + 1;
      const prefix = `${y}-${String(mo).padStart(2, "0")}`;
      const [revRow, expRow, aptRow] = await Promise.all([
        db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='receita' AND date LIKE $1", [`${prefix}%`]),
        db.get("SELECT COALESCE(SUM(amount),0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE $1", [`${prefix}%`]),
        db.get("SELECT COUNT(*) as c FROM appointments WHERE status='concluido' AND appointment_date LIKE $1", [`${prefix}%`]),
      ]);
      const revenue = Number((revRow as any)?.s ?? 0);
      const expenses = Number((expRow as any)?.s ?? 0);
      return { month: mo, year: y, revenue, expenses, profit: revenue - expenses, appointments: Number((aptRow as any)?.c ?? 0) };
    })
  );
  res.json(months);
});

router.get("/top-services", async (req, res) => {
  const { month, year, limit = 5 } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const rows = await db.all(`
    SELECT s.id as serviceId, s.name as serviceName, COUNT(*) as count,
      COALESCE(SUM(
        a.final_price * 1.0 / NULLIF((SELECT COUNT(*) FROM appointment_services aps2 WHERE aps2.appointment_id = a.id), 0)
      ), 0) as revenue
    FROM appointments a
    JOIN appointment_services aps ON aps.appointment_id = a.id
    JOIN services s ON s.id = aps.service_id
    WHERE a.status='concluido' AND a.appointment_date LIKE $1
    GROUP BY s.id, s.name ORDER BY count DESC LIMIT $2
  `, [`${prefix}%`, Number(limit)]) as any[];
  res.json(rows.map(r => ({ serviceId: r.serviceid, serviceName: r.servicename, count: Number(r.count), revenue: Number(r.revenue) })));
});

router.get("/top-customers", async (req, res) => {
  const { month, year, limit = 5 } = req.query as any;
  const { prefix } = getPeriodFilter(month ? Number(month) : undefined, year ? Number(year) : undefined);
  const rows = await db.all(`
    SELECT c.id as customerId, c.name as customerName, COALESCE(SUM(a.final_price), 0) as totalSpent, COUNT(*) as totalServices
    FROM appointments a JOIN customers c ON c.id = a.customer_id
    WHERE a.status='concluido' AND a.appointment_date LIKE $1
    GROUP BY c.id, c.name ORDER BY totalSpent DESC LIMIT $2
  `, [`${prefix}%`, Number(limit)]) as any[];
  res.json(rows.map(r => ({ customerId: r.customerid, customerName: r.customername, totalSpent: Number(r.totalspent), totalServices: Number(r.totalservices) })));
});

router.get("/upcoming-appointments", async (req, res) => {
  const { limit = 10 } = req.query as any;
  const now = new Date().toISOString();
  const rows = await db.all(`
    SELECT a.*,
      c.id as cid, c.name as cname, c.phone as cphone, c.email as cemail, c.total_spent as ctotal_spent, c.total_services as ctotal_services, c.created_at as ccreated_at, c.updated_at as cupdated_at,
      v.id as vid, v.brand as vbrand, v.model as vmodel, v.plate as vplate, v.color as vcolor, v.fuel as vfuel, v.year as vyear
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    WHERE a.appointment_date >= $1 AND a.status IN ('agendado','confirmado')
    ORDER BY a.appointment_date ASC LIMIT $2
  `, [now, Number(limit)]) as any[];

  const ids = rows.map((r) => r.id);
  const svcMap = await loadServicesMap(ids);
  res.json(rows.map((r) => mapAppointmentDetail(r, svcMap.get(r.id) || [])));
});

router.get("/customers-needing-service", async (req, res) => {
  const { days = 30, limit = 10 } = req.query as any;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(days));
  const rows = await db.all(`
    SELECT * FROM customers
    WHERE (last_service_date IS NOT NULL AND last_service_date < $1)
       OR (last_service_date IS NULL AND created_at < $2)
    ORDER BY last_service_date ASC LIMIT $3
  `, [cutoff.toISOString(), cutoff.toISOString(), Number(limit)]) as any[];
  res.json(rows.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp, email: c.email, totalSpent: Number(c.total_spent), totalServices: c.total_services, lastServiceDate: c.last_service_date, createdAt: c.created_at, updatedAt: c.updated_at })));
});

export default router;
