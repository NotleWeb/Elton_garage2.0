import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapFeedback(f: any) {
  return {
    id: f.id, customerId: f.customer_id, appointmentId: f.appointment_id, rating: f.rating, comment: f.comment, createdAt: f.created_at,
    customer: f.cname ? { id: f.customer_id, name: f.cname } : undefined,
  };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const total = (db.prepare("SELECT COUNT(*) as c FROM feedback").get() as any).c;
  const avg = (db.prepare("SELECT COALESCE(AVG(rating), 0) as avg FROM feedback").get() as any).avg;
  const data = db.prepare("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id ORDER BY f.created_at DESC LIMIT ? OFFSET ?").all(Number(limit), offset);
  res.json({ data: data.map(mapFeedback), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }, averageRating: avg });
});

router.post("/", (req, res) => {
  const { customerId, appointmentId, rating, comment } = req.body as any;
  if (!customerId || !rating) { res.status(400).json({ error: "validation", message: "Cliente e avaliação são obrigatórios" }); return; }
  const result = db.prepare("INSERT INTO feedback (customer_id, appointment_id, rating, comment) VALUES (?, ?, ?, ?)").run(customerId, appointmentId ?? null, rating, comment ?? null);
  const f = db.prepare("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id WHERE f.id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapFeedback(f));
});

router.get("/:id", (req, res) => {
  const f = db.prepare("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id WHERE f.id = ?").get(Number(req.params.id)) as any;
  if (!f) { res.status(404).json({ error: "not_found", message: "Avaliação não encontrada" }); return; }
  res.json(mapFeedback(f));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM feedback WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Avaliação não encontrada" }); return; }
  db.prepare("DELETE FROM feedback WHERE id = ?").run(id);
  res.json({ message: "Avaliação removida com sucesso" });
});

export default router;
