import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

async function loadServicesMap(appointmentIds: number[]): Promise<Map<number, any[]>> {
  if (!appointmentIds.length) return new Map();
  const rows = await db.all(`
    SELECT aps.appointment_id, s.id, s.name, s.price, s.estimated_duration, s.category, s.description, s.vehicle_type, s.active
    FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ANY($1::int[])
    ORDER BY aps.id
  `, [appointmentIds]) as any[];
  const map = new Map<number, any[]>();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) map.set(row.appointment_id, []);
    map.get(row.appointment_id)!.push({
      id: row.id, name: row.name, price: Number(row.price),
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
    appointmentDate: a.appointment_date, status: a.status, discount: Number(a.discount ?? 0),
    finalPrice: Number(a.final_price), totalDuration, observations: a.observations, createdAt: a.created_at,
    customer: { id: a.cid, name: a.cname, phone: a.cphone, email: a.cemail, totalSpent: Number(a.ctotal_spent), totalServices: a.ctotal_services, createdAt: a.ccreated_at, updatedAt: a.cupdated_at },
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

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "", status, dateFrom, dateTo, customerId, vehicleId } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = `WHERE (c.name ILIKE $1 OR v.plate ILIKE $2 OR EXISTS (
    SELECT 1 FROM appointment_services aps2
    JOIN services s2 ON s2.id = aps2.service_id
    WHERE aps2.appointment_id = a.id AND s2.name ILIKE $3
  ))`;
  const params: any[] = [like, like, like];
  if (status) { where += ` AND a.status = $${params.length + 1}`; params.push(status); }
  if (dateFrom) { where += ` AND a.appointment_date >= $${params.length + 1}`; params.push(dateFrom); }
  if (dateTo) { where += ` AND a.appointment_date <= $${params.length + 1}`; params.push(dateTo + "T23:59:59"); }
  if (customerId) { where += ` AND a.customer_id = $${params.length + 1}`; params.push(Number(customerId)); }
  if (vehicleId) { where += ` AND a.vehicle_id = $${params.length + 1}`; params.push(Number(vehicleId)); }
  const countSql = `SELECT COUNT(*) as c FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN vehicles v ON v.id = a.vehicle_id ${where}`;
  const [countRow, rows] = await Promise.all([
    db.get(countSql, params),
    db.all(`${appointmentJoin} ${where} ORDER BY a.appointment_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]),
  ]);
  const total = Number((countRow as any)?.c ?? 0);
  const ids = rows.map((r: any) => r.id);
  const svcMap = await loadServicesMap(ids);
  res.json({ data: rows.map((r: any) => mapAppointmentDetail(r, svcMap.get(r.id) || [])), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { customerId, vehicleId, serviceIds, appointmentDate, discount, observations } = req.body as any;
  if (!customerId || !vehicleId || !serviceIds?.length || !appointmentDate) {
    res.status(400).json({ error: "validation", message: "Campos obrigatorios faltando" });
    return;
  }
  const ids: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
  const serviceRows = await db.all(`SELECT * FROM services WHERE id = ANY($1::int[])`, [ids]) as any[];
  if (serviceRows.length !== ids.length) {
    res.status(400).json({ error: "validation", message: "Um ou mais servicos informados nao existem" });
    return;
  }
  const subtotal = serviceRows.reduce((sum: number, s: any) => sum + Number(s.price), 0);
  const discountAmount = discount ?? 0;
  const finalPrice = Math.max(0, subtotal - discountAmount);
  const aptId = await db.transaction(async (tx) => {
    const result = await tx.run(
      "INSERT INTO appointments (customer_id, vehicle_id, appointment_date, discount, final_price, observations) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [customerId, vehicleId, appointmentDate, discountAmount, finalPrice, observations ?? null]
    );
    for (const sid of ids) {
      await tx.run("INSERT INTO appointment_services (appointment_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [result.id, sid]);
    }
    return result.id!;
  });
  const created = await db.get(`${appointmentJoin} WHERE a.id = $1`, [aptId]) as any;
  const svcMap = await loadServicesMap([aptId]);
  res.status(201).json(mapAppointmentDetail(created, svcMap.get(aptId) || []));
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const a = await db.get(`${appointmentJoin} WHERE a.id = $1`, [id]) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }
  const svcMap = await loadServicesMap([id]);
  res.json(mapAppointmentDetail(a, svcMap.get(id) || []));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const a = await db.get("SELECT * FROM appointments WHERE id = $1", [id]) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }
  const { customerId, vehicleId, serviceIds, appointmentDate, status, discount, finalPrice, observations } = req.body as any;
  let validatedServiceRows: any[] | null = null;
  if (serviceIds?.length) {
    const ids: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
    const rows = await db.all(`SELECT id, price FROM services WHERE id = ANY($1::int[])`, [ids]) as any[];
    if (rows.length !== ids.length) {
      res.status(400).json({ error: "validation", message: "Um ou mais servicos informados nao existem" });
      return;
    }
    validatedServiceRows = rows;
  }
  await db.transaction(async (tx) => {
    let newFinalPrice = finalPrice ?? a.final_price;
    let newDiscount = discount ?? a.discount ?? 0;
    if (validatedServiceRows) {
      const ids2: number[] = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      const subtotal = validatedServiceRows.reduce((sum: number, s: any) => sum + Number(s.price), 0);
      newFinalPrice = finalPrice ?? Math.max(0, subtotal - newDiscount);
      await tx.run("DELETE FROM appointment_services WHERE appointment_id = $1", [id]);
      for (const sid of ids2) {
        await tx.run("INSERT INTO appointment_services (appointment_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [id, sid]);
      }
    } else if (discount !== undefined) {
      const existing = await tx.all("SELECT s.price FROM appointment_services aps JOIN services s ON s.id = aps.service_id WHERE aps.appointment_id = $1", [id]) as any[];
      const subtotal = existing.reduce((sum: number, s: any) => sum + Number(s.price), 0);
      newFinalPrice = finalPrice ?? Math.max(0, subtotal - newDiscount);
    }
    await tx.run(
      "UPDATE appointments SET customer_id=$1, vehicle_id=$2, appointment_date=$3, status=$4, discount=$5, final_price=$6, observations=$7 WHERE id=$8",
      [customerId ?? a.customer_id, vehicleId ?? a.vehicle_id, appointmentDate ?? a.appointment_date, status ?? a.status, newDiscount, newFinalPrice, observations ?? a.observations, id]
    );
  });
  if (status && status !== a.status) await handleStatusChange(id, a.status, status);
  const updated = await db.get(`${appointmentJoin} WHERE a.id = $1`, [id]) as any;
  const svcMap = await loadServicesMap([id]);
  res.json(mapAppointmentDetail(updated, svcMap.get(id) || []));
});

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const a = await db.get("SELECT * FROM appointments WHERE id = $1", [id]) as any;
  if (!a) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }
  const { status } = req.body as { status: string };
  if (!status) { res.status(400).json({ error: "validation", message: "Status e obrigatorio" }); return; }
  await db.run("UPDATE appointments SET status = $1 WHERE id = $2", [status, id]);
  await handleStatusChange(id, a.status, status);
  const updated = await db.get(`${appointmentJoin} WHERE a.id = $1`, [id]) as any;
  const svcMap = await loadServicesMap([id]);
  res.json(mapAppointmentDetail(updated, svcMap.get(id) || []));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM appointments WHERE id = $1", [id])) {
    res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM financial_transactions WHERE appointment_id = $1", [id]);
    await tx.run("DELETE FROM inventory_movements WHERE appointment_id = $1", [id]);
    await tx.run("DELETE FROM feedback WHERE appointment_id = $1", [id]);
    await tx.run("DELETE FROM appointments WHERE id = $1", [id]);
  });
  res.json({ message: "Agendamento removido com sucesso" });
});

export async function handleStatusChange(appointmentId: number, oldStatus: string, newStatus: string): Promise<void> {
  if (newStatus !== "concluido" || oldStatus === "concluido") return;
  const a = await db.get("SELECT * FROM appointments WHERE id = $1", [appointmentId]) as any;
  if (!a) return;
  const existingTx = await db.get("SELECT id FROM financial_transactions WHERE appointment_id = $1 AND type = 'receita'", [appointmentId]);
  if (existingTx) return;
  const services = await db.all(`
    SELECT s.* FROM appointment_services aps
    JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = $1
  `, [appointmentId]) as any[];
  const finalPrice = Number(a.final_price ?? services.reduce((s: number, sv: any) => s + Number(sv.price), 0) - Number(a.discount ?? 0));
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  await db.run(
    "UPDATE customers SET total_services = total_services + 1, total_spent = total_spent + $1, last_service_date = $2, updated_at = $3 WHERE id = $4",
    [finalPrice, now, now, a.customer_id]
  );
  const os = await db.get("SELECT * FROM order_services WHERE appointment_id = $1", [appointmentId]) as any;
  const paymentMethod = os?.payment_method ?? "dinheiro";
  const customer = await db.get("SELECT name FROM customers WHERE id = $1", [a.customer_id]) as any;
  const svcNames = services.map((s: any) => s.name).join(", ") || "Servico";
  await db.run(
    "INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    ["receita", "Servicos", `${svcNames} - ${customer?.name ?? ""}`, finalPrice, today, appointmentId, paymentMethod]
  );
  const hasWash = services.some((s: any) => s.category?.toLowerCase().includes("lavagem"));
  if (hasWash) {
    await db.run("INSERT INTO loyalty_cards (customer_id) VALUES ($1) ON CONFLICT DO NOTHING", [a.customer_id]);
    await db.run(
      "UPDATE loyalty_cards SET total_washes = total_washes + 1, current_stamp_count = current_stamp_count + 1, updated_at = $1 WHERE customer_id = $2",
      [now, a.customer_id]
    );
    const loyalty = await db.get("SELECT * FROM loyalty_cards WHERE customer_id = $1", [a.customer_id]) as any;
    if (loyalty && loyalty.current_stamp_count >= 10) {
      const newFreeWashes = Math.floor(loyalty.current_stamp_count / 10);
      const newStamps = loyalty.current_stamp_count % 10;
      await db.run("UPDATE loyalty_cards SET free_washes_earned = free_washes_earned + $1, current_stamp_count = $2, updated_at = $3 WHERE customer_id = $4",
        [newFreeWashes, newStamps, now, a.customer_id]);
      await db.run("INSERT INTO notifications (customer_id, title, message, type) VALUES ($1,$2,$3,$4)",
        [a.customer_id, "Lavagem Gratis!", `${customer?.name} ganhou ${newFreeWashes} lavagem gratis!`, "loyalty"]);
    }
  }
  const usages = await db.all("SELECT * FROM product_usage WHERE appointment_id = $1", [appointmentId]) as any[];
  for (const usage of usages) {
    await db.run("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2", [usage.quantity, usage.product_id]);
    await db.run("INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, appointment_id) VALUES ($1,$2,$3,$4,$5)",
      [usage.product_id, "saida", usage.quantity, `Utilizado no agendamento #${appointmentId}`, appointmentId]);
  }
  await db.run("INSERT INTO notifications (customer_id, title, message, type) VALUES ($1,$2,$3,$4)",
    [a.customer_id, "Servico Concluido", "Seu servico foi concluido com sucesso. Obrigado!", "system"]);
}

export default router;
