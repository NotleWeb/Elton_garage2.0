import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

/** Load services for a batch of appointment IDs. Returns a Map<appointmentId, Service[]> */
function loadServicesMap(appointmentIds: number[]): Map<number, any[]> {
  if (!appointmentIds.length) return new Map();
  const placeholders = appointmentIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT aps.appointment_id, s.id, s.name, s.price, s.estimated_duration, s.category, s.description, s.vehicle_type, s.active
    FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id IN (${placeholders})
    ORDER BY aps.id
  `).all(...appointmentIds) as any[];

  const map = new Map<number, any[]>();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) map.set(row.appointment_id, []);
    map.get(row.appointment_id)!.push({
      id: row.id, name: row.name, price: row.price,
      estimatedDuration: row.estimated_duration, category: row.category,
      description: row.description, vehicleType: row.vehicle_type, active: !!row.active,
    });
  }
  return map;
}

function mapAppointmentDetail(a: any, services: any[]) {
  const totalDuration = services.reduce((s, sv) => s + (sv.estimatedDuration || 0), 0);
  const orderService = a.os_id ? {
    id: a.os_id, appointmentId: a.id,
    beforePhotos: JSON.parse(a.os_before || "[]"), afterPhotos: JSON.parse(a.os_after || "[]"),
    checklist: JSON.parse(a.os_checklist || "{}"), observations: a.os_obs,
    paymentMethod: a.os_payment, technician: a.os_technician, signature: a.os_signature,
  } : undefined;
  return {
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id,
    serviceIds: services.map((s) => s.id),
    appointmentDate: a.appointment_date, status: a.status, discount: a.discount ?? 0,
    finalPrice: a.final_price, totalDuration, observations: a.observations, createdAt: a.created_at,
    customer: { id: a.cid, name: a.cname, phone: a.cphone, email: a.cemail, totalSpent: a.ctotal_spent, totalServices: a.ctotal_services, createdAt: a.ccreated_at, updatedAt: a.cupdated_at },
    vehicle: { id: a.vid, customerId: a.customer_id, brand: a.vbrand, model: a.vmodel, plate: a.vplate, color: a.vcolor, fuel: a.vfuel, year: a.vyear },
    services,
    orderService,
  };
}

const appointmentJoin = `
  SELECT a.*,
    c.id as cid, c.name as cname, c.phone as cphone, c.email as cemail, c.total_spent as ctotal_spent, c.total_services as ctotal_services, c.created_at as ccreated_at, c.updated_at as cupdated_at,
    v.id as vid, v.brand as vbrand, v.model as vmodel, v.plate as vplate, v.color as vcolor, v.fuel as vfuel, v.year as vyear,
    os.id as os_id, os.before_photos as os_before, os.after_photos as os_after, os.checklist as os_checklist,
    os.observations as os_obs, os.payment_method as os_payment, os.technician as os_technician, os.signature as os_signature
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  JOIN vehicles v ON v.id = a.vehicle_id
  LEFT JOIN order_services os ON os.appointment_id = a.id
`;

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "", status, dateFrom, dateTo, customerId, vehicleId } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;

  // Search: by customer name, plate, or service name (via EXISTS subquery)
  let where = `WHERE (c.name LIKE ? OR v.plate LIKE ? OR EXISTS (
    SELECT 1 FROM appointment_services aps2
    JOIN services s2 ON s2.id = aps2.service_id
    WHERE aps2.appointment_id = a.id AND s2.name LIKE ?
  ))`;
  const params: any[] = [like, like, like];

  if (status) { where += " AND a.status = ?"; params.push(status); }
  if (dateFrom) { where += " AND a.appointment_date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND a.appointment_date <= ?"; params.push(dateTo + "T23:59:59"); }
  if (customerId) { where += " AND a.customer_id = ?"; params.push(Number(customerId)); }
  if (vehicleId) { where += " AND a.vehicle_id = ?"; params.push(Number(vehicleId)); }

  const countSql = `
    SELECT COUNT(*) as c
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    ${where}
  `;
  const total = (db.prepare(countSql).get(...params) as any).c;
  const rows = db.prepare(`${appointmentJoin} ${where} ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset) as any[];

  const ids = rows.map((r) => r.id);
  const svcMap = loadServicesMap(ids);
  const data = rows.map((r) => mapAppointmentDetail(r, svcMap.get(r.id) || []));

  res.json({ data, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { customerId, vehicleId, serviceIds, appointmentDate, discount, observations } = req.body as any;
  if (!customerId || !vehicleId || !serviceIds?.length || !appointmentDate) {
    res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" });
    return;
  }

  const ids: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
  const placeholders = ids.map(() => "?").join(",");
  const serviceRows = db.prepare(`SELECT * FROM services WHERE id IN (${placeholders})`).all(...ids) as any[];
  if (serviceRows.length !== ids.length) {
    res.status(400).json({ error: "validation", message: "Um ou mais serviços informados não existem" });
    return;
  }

  const subtotal = serviceRows.reduce((sum: number, s: any) => sum + s.price, 0);
  const discountAmount = discount ?? 0;
  const finalPrice = Math.max(0, subtotal - discountAmount);

  const createAppointment = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO appointments (customer_id, vehicle_id, appointment_date, discount, final_price, observations) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(customerId, vehicleId, appointmentDate, discountAmount, finalPrice, observations ?? null);

    const aptId = result.lastInsertRowid as number;
    const insJunction = db.prepare("INSERT OR IGNORE INTO appointment_services (appointment_id, service_id) VALUES (?, ?)");
    for (const sid of ids) insJunction.run(aptId, sid);
    return aptId;
  });

  const aptId = createAppointment();
  const created = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(aptId) as any;
  const svcMap = loadServicesMap([aptId]);
  res.status(201).json(mapAppointmentDetail(created, svcMap.get(aptId) || []));
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(id) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }
  const svcMap = loadServicesMap([id]);
  res.json(mapAppointmentDetail(a, svcMap.get(id) || []));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" }); return; }

  const { customerId, vehicleId, serviceIds, appointmentDate, status, discount, finalPrice, observations } = req.body as any;

  // Validate serviceIds BEFORE the transaction so we can early-return from the route.
  // Doing this inside db.transaction() only exits the callback, not the route handler,
  // which causes a double-response (ERR_HTTP_HEADERS_SENT).
  let validatedServiceRows: any[] | null = null;
  if (serviceIds?.length) {
    const ids: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`SELECT id, price FROM services WHERE id IN (${placeholders})`).all(...ids) as any[];
    if (rows.length !== ids.length) {
      res.status(400).json({ error: "validation", message: "Um ou mais serviços informados não existem" });
      return;
    }
    validatedServiceRows = rows;
  }

  const updateAppointment = db.transaction(() => {
    let newFinalPrice = finalPrice ?? a.final_price;
    let newDiscount = discount ?? a.discount ?? 0;

    if (validatedServiceRows) {
      const ids: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      const subtotal = validatedServiceRows.reduce((sum: number, s: any) => sum + s.price, 0);
      newFinalPrice = finalPrice ?? Math.max(0, subtotal - newDiscount);

      // Replace junction entries
      db.prepare("DELETE FROM appointment_services WHERE appointment_id = ?").run(id);
      const insJunction = db.prepare("INSERT OR IGNORE INTO appointment_services (appointment_id, service_id) VALUES (?, ?)");
      for (const sid of ids) insJunction.run(id, sid);
    } else if (discount !== undefined) {
      // Discount changed but no new services; recalculate from current services
      const existingServices = db.prepare(
        "SELECT s.price FROM appointment_services aps JOIN services s ON s.id = aps.service_id WHERE aps.appointment_id = ?"
      ).all(id) as any[];
      const subtotal = existingServices.reduce((sum: number, s: any) => sum + s.price, 0);
      newFinalPrice = finalPrice ?? Math.max(0, subtotal - newDiscount);
    }

    db.prepare(
      "UPDATE appointments SET customer_id=?, vehicle_id=?, appointment_date=?, status=?, discount=?, final_price=?, observations=? WHERE id=?"
    ).run(
      customerId ?? a.customer_id,
      vehicleId ?? a.vehicle_id,
      appointmentDate ?? a.appointment_date,
      status ?? a.status,
      newDiscount,
      newFinalPrice,
      observations ?? a.observations,
      id
    );
  });

  updateAppointment();

  if (status && status !== a.status) handleStatusChange(id, a.status, status);

  const updated = db.prepare(`${appointmentJoin} WHERE a.id = ?`).get(id) as any;
  const svcMap = loadServicesMap([id]);
  res.json(mapAppointmentDetail(updated, svcMap.get(id) || []));
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
  const svcMap = loadServicesMap([id]);
  res.json(mapAppointmentDetail(updated, svcMap.get(id) || []));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM appointments WHERE id = ?").get(id)) {
    res.status(404).json({ error: "not_found", message: "Agendamento não encontrado" });
    return;
  }
  // appointment_services, order_services, product_usage are ON DELETE CASCADE
  const deleteRelated = db.transaction(() => {
    db.prepare("DELETE FROM financial_transactions WHERE appointment_id = ?").run(id);
    db.prepare("DELETE FROM inventory_movements WHERE appointment_id = ?").run(id);
    db.prepare("DELETE FROM feedback WHERE appointment_id = ?").run(id);
    db.prepare("DELETE FROM appointments WHERE id = ?").run(id);
  });
  deleteRelated();
  res.json({ message: "Agendamento removido com sucesso" });
});

export function handleStatusChange(appointmentId: number, oldStatus: string, newStatus: string) {
  if (newStatus !== "concluido" || oldStatus === "concluido") return;
  const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appointmentId) as any;
  if (!a) return;

  // Idempotency guard
  const existingTx = db.prepare("SELECT id FROM financial_transactions WHERE appointment_id = ? AND type = 'receita'").get(appointmentId);
  if (existingTx) return;

  // Load all services for this appointment
  const services = db.prepare(`
    SELECT s.* FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ?
  `).all(appointmentId) as any[];

  const finalPrice = a.final_price ?? services.reduce((sum: number, s: any) => sum + s.price, 0) - (a.discount ?? 0);

  // Update customer stats
  db.prepare(
    "UPDATE customers SET total_services = total_services + 1, total_spent = total_spent + ?, last_service_date = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(finalPrice, a.customer_id);

  // Generate financial transaction
  const os = db.prepare("SELECT * FROM order_services WHERE appointment_id = ?").get(appointmentId) as any;
  const paymentMethod = os?.payment_method ?? "dinheiro";
  const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(a.customer_id) as any;
  const svcNames = services.map((s: any) => s.name).join(", ") || "Serviço";
  db.prepare(
    "INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES (?, ?, ?, ?, date('now'), ?, ?)"
  ).run("receita", "Serviços", `${svcNames} - ${customer?.name ?? ""}`, finalPrice, appointmentId, paymentMethod);

  // Update loyalty card: count if ANY service is in the "lavagem" category
  const hasWash = services.some((s: any) => s.category?.toLowerCase().includes("lavagem"));
  if (hasWash) {
    db.prepare("INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)").run(a.customer_id);
    db.prepare(
      "UPDATE loyalty_cards SET total_washes = total_washes + 1, current_stamp_count = current_stamp_count + 1, updated_at = datetime('now') WHERE customer_id = ?"
    ).run(a.customer_id);
    const loyalty = db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(a.customer_id) as any;
    if (loyalty && loyalty.current_stamp_count >= 10) {
      const newFreeWashes = Math.floor(loyalty.current_stamp_count / 10);
      const newStamps = loyalty.current_stamp_count % 10;
      db.prepare(
        "UPDATE loyalty_cards SET free_washes_earned = free_washes_earned + ?, current_stamp_count = ?, updated_at = datetime('now') WHERE customer_id = ?"
      ).run(newFreeWashes, newStamps, a.customer_id);
      db.prepare(
        "INSERT INTO notifications (customer_id, title, message, type) VALUES (?, ?, ?, ?)"
      ).run(a.customer_id, "Lavagem Grátis Disponível!", `${customer?.name} ganhou ${newFreeWashes} lavagem grátis!`, "loyalty");
    }
  }

  // Decrease product stock from usage
  const usages = db.prepare("SELECT * FROM product_usage WHERE appointment_id = ?").all(appointmentId) as any[];
  for (const usage of usages) {
    db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").run(usage.quantity, usage.product_id);
    db.prepare(
      "INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, appointment_id) VALUES (?, ?, ?, ?, ?)"
    ).run(usage.product_id, "saida", usage.quantity, `Utilizado no agendamento #${appointmentId}`, appointmentId);
  }

  // Generate reminder notification
  db.prepare(
    "INSERT INTO notifications (customer_id, title, message, type) VALUES (?, ?, ?, ?)"
  ).run(a.customer_id, "Serviço Concluído", "Seu serviço foi concluído com sucesso. Obrigado!", "system");
}

export default router;
