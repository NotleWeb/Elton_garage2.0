import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapCustomer(c: any) {
  return {
    id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp, email: c.email,
    address: c.address, notes: c.notes, totalSpent: Number(c.total_spent), totalServices: c.total_services,
    lastServiceDate: c.last_service_date, createdAt: c.created_at, updatedAt: c.updated_at,
  };
}

function mapLoyalty(l: any, customer?: any) {
  return {
    id: l.id, customerId: l.customer_id, totalWashes: l.total_washes, currentStampCount: l.current_stamp_count,
    freeWashesEarned: l.free_washes_earned, freeWashesUsed: l.free_washes_used,
    freeWashesPending: l.free_washes_earned - l.free_washes_used, updatedAt: l.updated_at,
    customer: customer ? { id: customer.id, name: customer.name } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "", sortBy = "name", sortOrder = "asc" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const allowedSort: Record<string, string> = { name: "name", totalSpent: "total_spent", totalServices: "total_services", lastServiceDate: "last_service_date", createdAt: "created_at" };
  const col = allowedSort[sortBy] ?? "name";
  const dir = sortOrder === "desc" ? "DESC" : "ASC";
  const [countRow, data] = await Promise.all([
    db.get("SELECT COUNT(*) as c FROM customers WHERE name ILIKE $1 OR phone ILIKE $2 OR email ILIKE $3", [like, like, like]),
    db.all(`SELECT * FROM customers WHERE name ILIKE $1 OR phone ILIKE $2 OR email ILIKE $3 ORDER BY ${col} ${dir} LIMIT $4 OFFSET $5`, [like, like, like, Number(limit), offset]),
  ]);
  const total = Number((countRow as any)?.c ?? 0);
  res.json({ data: data.map(mapCustomer), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  if (!name) { res.status(400).json({ error: "validation", message: "Nome é obrigatório" }); return; }
  const result = await db.run("INSERT INTO customers (name, phone, whatsapp, email, address, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [name, phone ?? null, whatsapp ?? null, email ?? null, address ?? null, notes ?? null]);
  await db.run("INSERT INTO loyalty_cards (customer_id) VALUES ($1) ON CONFLICT DO NOTHING", [result.id]);
  const customer = await db.get("SELECT * FROM customers WHERE id = $1", [result.id]) as any;
  res.status(201).json(mapCustomer(customer));
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [customer, vehicles, loyalty] = await Promise.all([
    db.get("SELECT * FROM customers WHERE id = $1", [id]),
    db.all("SELECT * FROM vehicles WHERE customer_id = $1", [id]),
    db.get("SELECT * FROM loyalty_cards WHERE customer_id = $1", [id]),
  ]);
  if (!customer) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  const c = customer as any;
  const l = loyalty as any;
  const mapVehicle = (v: any) => ({ id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes });
  const mappedLoyalty = l ? { id: l.id, customerId: l.customer_id, totalWashes: l.total_washes, currentStampCount: l.current_stamp_count, freeWashesEarned: l.free_washes_earned, freeWashesUsed: l.free_washes_used, freeWashesPending: l.free_washes_earned - l.free_washes_used, updatedAt: l.updated_at } : null;
  res.json({ ...mapCustomer(c), vehicles: vehicles.map(mapVehicle), loyaltyCard: mappedLoyalty });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const customer = await db.get("SELECT * FROM customers WHERE id = $1", [id]) as any;
  if (!customer) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  await db.run("UPDATE customers SET name=$1, phone=$2, whatsapp=$3, email=$4, address=$5, notes=$6, updated_at=$7 WHERE id=$8",
    [name ?? customer.name, phone ?? customer.phone, whatsapp ?? customer.whatsapp, email ?? customer.email, address ?? customer.address, notes ?? customer.notes, new Date().toISOString(), id]);
  const updated = await db.get("SELECT * FROM customers WHERE id = $1", [id]) as any;
  res.json(mapCustomer(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM customers WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  const linked = await db.get("SELECT id FROM appointments WHERE customer_id = $1 LIMIT 1", [id]);
  if (linked) { res.status(409).json({ error: "conflict", message: "Cliente possui agendamentos vinculados. Remova os agendamentos antes de excluir o cliente." }); return; }
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM notifications WHERE customer_id = $1", [id]);
    await tx.run("DELETE FROM feedback WHERE customer_id = $1", [id]);
    await tx.run("DELETE FROM customers WHERE id = $1", [id]);
  });
  res.json({ message: "Cliente removido com sucesso" });
});

router.get("/:id/vehicles", async (req, res) => {
  const id = Number(req.params.id);
  const vehicles = await db.all("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.customer_id = $1", [id]);
  res.json(vehicles.map((v: any) => ({ id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes, customerName: v.customer_name })));
});

router.get("/:id/appointments", async (req, res) => {
  const id = Number(req.params.id);
  const appointments = await db.all(`
    SELECT a.*, c.id as cid, c.name as cname, v.id as vid, v.brand, v.model, v.plate
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    WHERE a.customer_id = $1 ORDER BY a.appointment_date DESC
  `, [id]) as any[];

  const aptIds = appointments.map((a: any) => a.id);
  const svcMap = new Map<number, any[]>();
  if (aptIds.length) {
    const rows = await db.all(`
      SELECT aps.appointment_id, s.id, s.name, s.price, s.estimated_duration, s.category
      FROM appointment_services aps
      JOIN services s ON s.id = aps.service_id
      WHERE aps.appointment_id = ANY($1::int[])
    `, [aptIds]) as any[];
    for (const row of rows) {
      if (!svcMap.has(row.appointment_id)) svcMap.set(row.appointment_id, []);
      svcMap.get(row.appointment_id)!.push({ id: row.id, name: row.name, price: Number(row.price), estimatedDuration: row.estimated_duration, category: row.category });
    }
  }

  const data = appointments.map((a: any) => {
    const services = svcMap.get(a.id) || [];
    return {
      id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id,
      serviceIds: services.map((s: any) => s.id),
      appointmentDate: a.appointment_date, status: a.status, discount: Number(a.discount ?? 0),
      finalPrice: Number(a.final_price), observations: a.observations, createdAt: a.created_at,
      customer: a.cid ? { id: a.cid, name: a.cname } : undefined,
      vehicle: a.vid ? { id: a.vid, customerId: a.customer_id, brand: a.brand, model: a.model, plate: a.plate } : undefined,
      services,
    };
  });
  res.json({ data, meta: { total: data.length, page: 1, limit: data.length, totalPages: 1 } });
});

router.get("/:id/loyalty", async (req, res) => {
  const id = Number(req.params.id);
  await db.run("INSERT INTO loyalty_cards (customer_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
  const [loyalty, customer] = await Promise.all([
    db.get("SELECT * FROM loyalty_cards WHERE customer_id = $1", [id]),
    db.get("SELECT * FROM customers WHERE id = $1", [id]),
  ]);
  res.json(mapLoyalty(loyalty as any, customer as any));
});

export default router;
