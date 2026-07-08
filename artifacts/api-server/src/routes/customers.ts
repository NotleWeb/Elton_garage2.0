import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapCustomer(c: any) {
  return {
    id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp, email: c.email,
    address: c.address, notes: c.notes, totalSpent: c.total_spent, totalServices: c.total_services,
    lastServiceDate: c.last_service_date, createdAt: c.created_at, updatedAt: c.updated_at,
  };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "", sortBy = "name", sortOrder = "asc" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const allowedSort: Record<string, string> = { name: "name", totalSpent: "total_spent", totalServices: "total_services", lastServiceDate: "last_service_date", createdAt: "created_at" };
  const col = allowedSort[sortBy] ?? "name";
  const dir = sortOrder === "desc" ? "DESC" : "ASC";
  const total = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?").get(like, like, like) as any).c;
  const data = db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`).all(like, like, like, Number(limit), offset);
  res.json({ data: data.map(mapCustomer), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  if (!name) { res.status(400).json({ error: "validation", message: "Nome é obrigatório" }); return; }
  const result = db.prepare("INSERT INTO customers (name, phone, whatsapp, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)").run(name, phone ?? null, whatsapp ?? null, email ?? null, address ?? null, notes ?? null);
  db.prepare("INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)").run(result.lastInsertRowid);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapCustomer(customer));
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as any;
  if (!customer) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  const vehicles = db.prepare("SELECT * FROM vehicles WHERE customer_id = ?").all(id);
  const loyalty = db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(id) as any;
  const mapVehicle = (v: any) => ({ id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes });
  const mappedLoyalty = loyalty ? { id: loyalty.id, customerId: loyalty.customer_id, totalWashes: loyalty.total_washes, currentStampCount: loyalty.current_stamp_count, freeWashesEarned: loyalty.free_washes_earned, freeWashesUsed: loyalty.free_washes_used, freeWashesPending: loyalty.free_washes_earned - loyalty.free_washes_used, updatedAt: loyalty.updated_at } : null;
  res.json({ ...mapCustomer(customer), vehicles: vehicles.map(mapVehicle), loyaltyCard: mappedLoyalty });
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as any;
  if (!customer) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  db.prepare("UPDATE customers SET name=?, phone=?, whatsapp=?, email=?, address=?, notes=?, updated_at=datetime('now') WHERE id=?")
    .run(name ?? customer.name, phone ?? customer.phone, whatsapp ?? customer.whatsapp, email ?? customer.email, address ?? customer.address, notes ?? customer.notes, id);
  const updated = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as any;
  res.json(mapCustomer(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!customer) { res.status(404).json({ error: "not_found", message: "Cliente não encontrado" }); return; }
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  res.json({ message: "Cliente removido com sucesso" });
});

router.get("/:id/vehicles", (req, res) => {
  const id = Number(req.params.id);
  const vehicles = db.prepare("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.customer_id = ?").all(id);
  res.json(vehicles.map((v: any) => ({ id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes, customerName: v.customer_name })));
});

router.get("/:id/appointments", (req, res) => {
  const id = Number(req.params.id);
  const appointments = db.prepare(`
    SELECT a.*, c.id as cid, c.name as cname, v.id as vid, v.brand, v.model, v.plate, s.id as sid, s.name as sname, s.price as sprice
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN vehicles v ON v.id = a.vehicle_id
    JOIN services s ON s.id = a.service_id
    WHERE a.customer_id = ? ORDER BY a.appointment_date DESC
  `).all(id);
  const data = appointments.map(mapAppointmentDetail);
  res.json({ data, meta: { total: data.length, page: 1, limit: data.length, totalPages: 1 } });
});

router.get("/:id/loyalty", (req, res) => {
  const id = Number(req.params.id);
  let loyalty = db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(id) as any;
  if (!loyalty) {
    db.prepare("INSERT OR IGNORE INTO loyalty_cards (customer_id) VALUES (?)").run(id);
    loyalty = db.prepare("SELECT * FROM loyalty_cards WHERE customer_id = ?").get(id) as any;
  }
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as any;
  res.json(mapLoyalty(loyalty, customer));
});

function mapAppointmentDetail(a: any) {
  return {
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id, serviceId: a.service_id,
    appointmentDate: a.appointment_date, status: a.status, discount: a.discount, finalPrice: a.final_price,
    observations: a.observations, createdAt: a.created_at,
    customer: a.cid ? { id: a.cid, name: a.cname } : undefined,
    vehicle: a.vid ? { id: a.vid, customerId: a.customer_id, brand: a.brand, model: a.model, plate: a.plate } : undefined,
    service: a.sid ? { id: a.sid, name: a.sname, price: a.sprice } : undefined,
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

export default router;
