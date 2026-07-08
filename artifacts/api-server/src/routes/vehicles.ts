import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapVehicle(v: any) {
  return { id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes, customerName: v.customer_name };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const total = (db.prepare("SELECT COUNT(*) as c FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.brand LIKE ? OR v.model LIKE ? OR v.plate LIKE ? OR c.name LIKE ?").get(like, like, like, like) as any).c;
  const data = db.prepare("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.brand LIKE ? OR v.model LIKE ? OR v.plate LIKE ? OR c.name LIKE ? ORDER BY c.name LIMIT ? OFFSET ?").all(like, like, like, like, Number(limit), offset);
  res.json({ data: data.map(mapVehicle), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { customerId, brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  if (!customerId || !brand || !model) { res.status(400).json({ error: "validation", message: "Cliente, marca e modelo são obrigatórios" }); return; }
  const result = db.prepare("INSERT INTO vehicles (customer_id, brand, model, year, plate, color, fuel, mileage, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(customerId, brand, model, year ?? null, plate ?? null, color ?? null, fuel ?? null, mileage ?? null, notes ?? null);
  const vehicle = db.prepare("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapVehicle(vehicle));
});

router.get("/:id", (req, res) => {
  const vehicle = db.prepare("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = ?").get(Number(req.params.id)) as any;
  if (!vehicle) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  res.json(mapVehicle(vehicle));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const v = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id) as any;
  if (!v) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  const { brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  db.prepare("UPDATE vehicles SET brand=?, model=?, year=?, plate=?, color=?, fuel=?, mileage=?, notes=? WHERE id=?").run(brand ?? v.brand, model ?? v.model, year ?? v.year, plate ?? v.plate, color ?? v.color, fuel ?? v.fuel, mileage ?? v.mileage, notes ?? v.notes, id);
  const updated = db.prepare("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = ?").get(id) as any;
  res.json(mapVehicle(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  db.prepare("DELETE FROM vehicles WHERE id = ?").run(id);
  res.json({ message: "Veículo removido com sucesso" });
});

export default router;
