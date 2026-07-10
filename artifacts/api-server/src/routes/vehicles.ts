import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapVehicle(v: any) {
  return { id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model, year: v.year, plate: v.plate, color: v.color, fuel: v.fuel, mileage: v.mileage, notes: v.notes, customerName: v.customer_name };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const total = Number((await db.get("SELECT COUNT(*) as c FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.brand ILIKE $1 OR v.model ILIKE $2 OR v.plate ILIKE $3 OR c.name ILIKE $4", [like, like, like, like]))?.c ?? 0);
  const data = await db.all("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.brand ILIKE $1 OR v.model ILIKE $2 OR v.plate ILIKE $3 OR c.name ILIKE $4 ORDER BY c.name LIMIT $5 OFFSET $6", [like, like, like, like, Number(limit), offset]);
  res.json({ data: data.map(mapVehicle), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { customerId, brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  if (!customerId || !brand || !model) { res.status(400).json({ error: "validation", message: "Cliente, marca e modelo são obrigatórios" }); return; }
  const result = await db.run("INSERT INTO vehicles (customer_id, brand, model, year, plate, color, fuel, mileage, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [customerId, brand, model, year ?? null, plate ?? null, color ?? null, fuel ?? null, mileage ?? null, notes ?? null]);
  const vehicle = await db.get("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = $1", [result.id]) as any;
  res.status(201).json(mapVehicle(vehicle));
});

router.get("/:id", async (req, res) => {
  const vehicle = await db.get("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = $1", [Number(req.params.id)]) as any;
  if (!vehicle) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  res.json(mapVehicle(vehicle));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const v = await db.get("SELECT * FROM vehicles WHERE id = $1", [id]) as any;
  if (!v) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  const { brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  await db.run("UPDATE vehicles SET brand=$1, model=$2, year=$3, plate=$4, color=$5, fuel=$6, mileage=$7, notes=$8 WHERE id=$9", [brand ?? v.brand, model ?? v.model, year ?? v.year, plate ?? v.plate, color ?? v.color, fuel ?? v.fuel, mileage ?? v.mileage, notes ?? v.notes, id]);
  const updated = await db.get("SELECT v.*, c.name as customer_name FROM vehicles v JOIN customers c ON c.id = v.customer_id WHERE v.id = $1", [id]) as any;
  res.json(mapVehicle(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM vehicles WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Veículo não encontrado" }); return; }
  await db.run("DELETE FROM vehicles WHERE id = $1", [id]);
  res.json({ message: "Veículo removido com sucesso" });
});

export default router;
