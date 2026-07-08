import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapAppointmentDetail(a: any) {
  const orderService = a.os_id ? {
    id: a.os_id, appointmentId: a.id,
    beforePhotos: JSON.parse(a.os_before || "[]"), afterPhotos: JSON.parse(a.os_after || "[]"),
    checklist: JSON.parse(a.os_checklist || "{}"), observations: a.os_obs,
    paymentMethod: a.os_payment, technician: a.os_technician, signature: a.os_signature,
  } : undefined;
  return {
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id, serviceId: a.service_id,
    appointmentDate: a.appointment_date, status: a.status, discount: a.discount ?? 0,
    finalPrice: a.final_price, observations: a.observations, createdAt: a.created_at,
    customer: { id: a.cid, name: a.cname, phone: a.cphone, email: a.cemail, totalSpent: a.ctotal_spent, totalServices: a.ctotal_services, createdAt: a.ccreated_at, updatedAt: a.cupdated_at },
    vehicle: { id: a.vid, customerId: a.customer_id, brand: a.vbrand, model: a.vmodel, plate: a.vplate, color: a.vcolor, fuel: a.vfuel, year: a.vyear },
    service: { id: a.sid, name: a.sname, price: a.sprice, estimatedDuration: a.sduration, category: a.scategory },
    orderService,
  };
}

const appointmentJoin = `
  SELECT a.*,
    c.id as cid, c.name as cname, c.phone as cphone, c.email as cemail, c.total_spent as ctotal_spent, c.total_services as ctotal_services, c.created_at as ccreated_at, c.updated_at as cupdated_at,
    v.id as vid, v.brand as vbrand, v.model as vmodel, v.plate as vplate, v.color as vcolor, v.fuel as vfuel, v.year as vyear,
    s.id as sid, s.name as sname, s.price as sprice, s.estimated_duration as sduration, s.category as scategory,
    os.id as os_id, os.before_photos as os_before, os.after_photos as os_after, os.checklist as os_checklist,
    os.observations as os_obs, os.payment_method as os_payment, os.technician as os_technician, os.signature as os_signature
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  JOIN vehicles v ON v.id = a.vehicle_id
  JOIN services s ON s.id = a.service_id
  LEFT JOIN order_services os ON os.appointment_id = a.id
`;

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "", status, dateFrom, dateTo, customerId, vehicleId } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = "WHERE (c.name LIKE ? OR s.name LIKE ? OR v.plate LIKE ?)";
  const params: any[] = [like, like, like];
  if (status) { where += " AND a.status = ?"; params.push(status); }
  if (dateFrom) { where += " AND a.appointment_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND a.appointment_date <= ?"; params.push(dateTo + "T23:59:59"); }
  if (customerId) { where += " AND a.customer_id = ?"; params.push(Number(customerId)); }
  if (vehicleId) { where += " AND a.vehicle_id = ?"; params.push(Number(vehicleId)); }
  const countSql = `SELECT COUNT(*) as c FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN vehicles v ON v.id = a.vehicle_id JOIN services s ON s.id = a.service_id ${where}`;
  const total = (db.prepare(countSql).get(...params) as any).c;
  const data = db.prepare(`${appointmentJoin} ${where} ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapAppointmentDetail), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { customerId, vehicleId, serviceId, appointmentDate, discount, observations } = req.body as any;
  if (!customerId || !vehicleId || !serviceId || !appointmentDate) { res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" }); return; }
  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId) as any;
  const finalPrice = service ? service.price - (discount ?? 0) : null;
  const result = db.prepare("INSERT INTO appointments (customer_id, vehicle_id, service_id, appointment_date, discount, final_price, observations) VALUES (?, ?, ?, ?, ?, ?, ?)").run(customerId, vehicleId, serviceId, appointmentDate, discount ?? 0, finalPrice, observations ?? null);
  const created = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(result.lastInsertRowid) as any;
  res.status(201).json(mapAppointmentDetail(created));
});

router.get("/:id", (req, res) => {
  const a = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(Number(req.params.id)) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }
  res.json(mapAppointmentDetail(a));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }
  const { customerId, vehicleId, serviceId, appointmentDate, status, discount, finalPrice, observations } = req.body as any;
  const newServiceId = serviceId ?? a.service_id;
  const newDiscount = discount ?? a.discount ?? 0;
  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(newServiceId) as any;
  const newFinalPrice = finalPrice ?? (service ? service.price - newDiscount : a.final_price);
  db.prepare("UPDATE appointments SET customer_id=?, vehicle_id=?, service_id=?, appointment_date=?, status=?, discount=?, final_price=?, observations=? WHERE id=?")
    .run(customerId ?? a.customer_id, vehicleId ?? a.vehicle_id, newServiceId, appointmentDate ?? a.appointment_date, status ?? a.status, newDiscount, newFinalPrice, observations ?? a.observations, id);
  if (status && status !== a.status) handleStatusChange(id, a.status, status);
  const updated = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(id) as any;
  res.json(mapAppointmentDetail(updated));
});

router.patch("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }
  const { status } = req.body as { status: string };
  if (!status) { res.status(400).json({ error: "validation", message: "Status é obrigatório" }); return; }
  db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
  handleStatusChange(id, a.status, status);
  const updated = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(id) as any;
  res.json(mapAppointmentDetail(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM appointments WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }
  db.prepare("DELETE FROM appointments WHERE id = ?").run(id);
  res.json({ message: "Agendamento removido com sucesso" });
});

function handleStatusChange(appointmentId: number, oldStatus: string, newStatus: string) {
  if (newStatus !== "concluido" || oldStatus === "concluido") return;
  const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId) as any;
  if (!a) return;
  // Idempotency guard: if a revenue transaction already exists for this appointment, skip
  const existingTx = db.prepare("SELECT id FROM financial_transactions WHERE appointment_id = ? AND type = 'receita'").get(appointmentId);
  if (existingTx) return;
  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(a.service_id) as any;
  const finalPrice = a.final_price ?? (service ? service.price - (a.discount ?? 0) : 0);

  // Update customer stats
  db.prepare("UPDATE customers SET total_services = total_services + 1, total_spent = total_spent + ?, last_service_date = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(finalPrice, a.customer_id);

  // Generate financial transaction
  const os = db.prepare("SELECT * FROM order_services WHERE appointment_id = ?").get(appointmentId) as any;
  const paymentMethod = os?.payment_method ?? "dinheiro";
  const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(a.customer_id) as any;
  const svcName = service?.name ?? "Serviço";
  db.prepare("INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES (?, ?, ?, ?, date('now'), ?, ?)").run("receita", "Serviços", `${svcName} - ${customer?.name ?? ""}`, finalPrice, appointmentId, paymentMethod);

  // Update loyalty card (counts completed washes from "lavagem" category)
  if (service?.category?.toLowerCase().includes("lavagem")) {
    db.prepare("INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)").run(a.customer_id);
    db.prepare("UPDATE loyalty_cards SET total_washes = total_washes + 1, current_stamp_count = current_stamp_count + 1, updated_at = datetime('now') WHERE customer_id = ?").run(a.customer_id);
    // Check if earned free wash (every 10 stamps)
    const loyalty = db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(a.customer_id) as any;
    if (loyalty && loyalty.current_stamp_count >= 10) {
      const newFreeWashes = Math.floor(loyalty.current_stamp_count / 10);
      const newStamps = loyalty.current_stamp_count % 10;
      db.prepare("UPDATE loyalty_cards SET free_washes_earned = free_washes_earned + ?, current_stamp_count = ?, updated_at = datetime('now') WHERE customer_id = ?").run(newFreeWashes, newStamps, a.customer_id);
      db.prepare("INSERT INTO notifications (customer_id, title, message, type) VALUES (?, ?, ?, ?)").run(a.customer_id, "Lavagem Grátis Disponível!", `${customer?.name} ganhou ${newFreeWashes} lavagem grátis!`, "loyalty");
    }
  }

  // Decrease product stock from usage
  const usages = db.prepare("SELECT * FROM product_usage WHERE appointment_id = ?").all(appointmentId) as any[];
  for (const usage of usages) {
    db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").run(usage.quantity, usage.product_id);
    db.prepare("INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, appointment_id) VALUES (?, ?, ?, ?, ?)").run(usage.product_id, "saida", usage.quantity, `Utilizado no agendamento #${appointmentId}`, appointmentId);
  }

  // Generate reminder notification
  db.prepare("INSERT INTO notifications (customer_id, title, message, type) VALUES (?, ?, ?, ?)").run(a.customer_id, "Serviço Concluído", `Seu serviço foi concluído com sucesso. Obrigado!`, "system");
}

export { handleStatusChange };
export default router;
