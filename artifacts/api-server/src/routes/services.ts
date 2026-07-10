import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapService(s: any) {
  return { id: s.id, name: s.name, description: s.description, price: s.price, estimatedDuration: s.estimated_duration, category: s.category, vehicleType: s.vehicle_type, active: !!s.active };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "", category, active } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = "WHERE (name LIKE ? OR description LIKE ?)";
  const params: any[] = [like, like];
  if (category) { where += " AND category = ?"; params.push(category); }
  if (active !== undefined) { where += " AND active = ?"; params.push(active === "true" ? 1 : 0); }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM services ${where}`).get(...params) as any).c;
  const data = db.prepare(`SELECT * FROM services ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapService), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  if (!name || price === undefined) { res.status(400).json({ error: "validation", message: "Nome e preço são obrigatórios" }); return; }
  const result = db.prepare("INSERT INTO services (name, description, price, estimated_duration, category, vehicle_type, active) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, description ?? null, price, estimatedDuration ?? null, category ?? null, vehicleType ?? "todos", active !== undefined ? (active ? 1 : 0) : 1);
  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapService(service));
});

router.get("/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM services WHERE id = ?").get(Number(req.params.id)) as any;
  if (!s) { res.status(404).json({ error: "not_found", message: "Serviço não encontrado" }); return; }
  res.json(mapService(s));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as any;
  if (!s) { res.status(404).json({ error: "not_found", message: "Serviço não encontrado" }); return; }
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  db.prepare("UPDATE services SET name=?, description=?, price=?, estimated_duration=?, category=?, vehicle_type=?, active=? WHERE id=?").run(name ?? s.name, description ?? s.description, price ?? s.price, estimatedDuration ?? s.estimated_duration, category ?? s.category, vehicleType ?? s.vehicle_type, active !== undefined ? (active ? 1 : 0) : s.active, id);
  const updated = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as any;
  res.json(mapService(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM services WHERE id = ?").get(id)) {
    res.status(404).json({ error: "not_found", message: "Serviço não encontrado" });
    return;
  }
  const linked = db.prepare("SELECT id FROM appointment_services WHERE service_id = ? LIMIT 1").get(id);
  if (linked) {
    res.status(409).json({ error: "conflict", message: "Serviço está vinculado a agendamentos existentes e não pode ser excluído." });
    return;
  }
  db.prepare("DELETE FROM services WHERE id = ?").run(id);
  res.json({ message: "Serviço removido com sucesso" });
});

export default router;
