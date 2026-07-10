import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapService(s: any) {
  return { id: s.id, name: s.name, description: s.description, price: Number(s.price), estimatedDuration: s.estimated_duration, category: s.category, vehicleType: s.vehicle_type, active: !!s.active };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "", category, active } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = "WHERE (name ILIKE $1 OR description ILIKE $2)";
  const params: any[] = [like, like];
  if (category) { where += ` AND category = $${params.length + 1}`; params.push(category); }
  if (active !== undefined) { where += ` AND active = $${params.length + 1}`; params.push(active === "true" ? 1 : 0); }
  const total = Number((await db.get(`SELECT COUNT(*) as c FROM services ${where}`, params))?.c ?? 0);
  const data = await db.all(`SELECT * FROM services ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]);
  res.json({ data: data.map(mapService), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  if (!name || price === undefined) { res.status(400).json({ error: "validation", message: "Nome e preço são obrigatórios" }); return; }
  const result = await db.run("INSERT INTO services (name, description, price, estimated_duration, category, vehicle_type, active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [name, description ?? null, price, estimatedDuration ?? null, category ?? null, vehicleType ?? "todos", active !== undefined ? (active ? 1 : 0) : 1]);
  const service = await db.get("SELECT * FROM services WHERE id = $1", [result.id]) as any;
  res.status(201).json(mapService(service));
});

router.get("/:id", async (req, res) => {
  const s = await db.get("SELECT * FROM services WHERE id = $1", [Number(req.params.id)]) as any;
  if (!s) { res.status(404).json({ error: "not_found", message: "Serviço não encontrado" }); return; }
  res.json(mapService(s));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const s = await db.get("SELECT * FROM services WHERE id = $1", [id]) as any;
  if (!s) { res.status(404).json({ error: "not_found", message: "Serviço não encontrado" }); return; }
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  await db.run("UPDATE services SET name=$1, description=$2, price=$3, estimated_duration=$4, category=$5, vehicle_type=$6, active=$7 WHERE id=$8", [name ?? s.name, description ?? s.description, price ?? s.price, estimatedDuration ?? s.estimated_duration, category ?? s.category, vehicleType ?? s.vehicle_type, active !== undefined ? (active ? 1 : 0) : s.active, id]);
  const updated = await db.get("SELECT * FROM services WHERE id = $1", [id]) as any;
  res.json(mapService(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM services WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Serviço não encontrado" }); return; }
  const linked = await db.get("SELECT id FROM appointment_services WHERE service_id = $1 LIMIT 1", [id]);
  if (linked) { res.status(409).json({ error: "conflict", message: "Serviço está vinculado a agendamentos existentes e não pode ser excluído." }); return; }
  await db.run("DELETE FROM services WHERE id = $1", [id]);
  res.json({ message: "Serviço removido com sucesso" });
});

export default router;
