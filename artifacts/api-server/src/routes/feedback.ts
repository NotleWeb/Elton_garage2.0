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

router.get("/", async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const [countRow, avgRow, data] = await Promise.all([
    db.get("SELECT COUNT(*) as c FROM feedback"),
    db.get("SELECT COALESCE(AVG(rating), 0) as avg FROM feedback"),
    db.all("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id ORDER BY f.created_at DESC LIMIT $1 OFFSET $2", [Number(limit), offset]),
  ]);
  const total = Number((countRow as any)?.c ?? 0);
  res.json({ data: data.map(mapFeedback), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }, averageRating: Number((avgRow as any)?.avg ?? 0) });
});

router.post("/", async (req, res) => {
  const { customerId, appointmentId, rating, comment } = req.body as any;
  if (!customerId || !rating) { res.status(400).json({ error: "validation", message: "Cliente e avaliação são obrigatórios" }); return; }
  const result = await db.run("INSERT INTO feedback (customer_id, appointment_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING id", [customerId, appointmentId ?? null, rating, comment ?? null]);
  const f = await db.get("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id WHERE f.id = $1", [result.id]) as any;
  res.status(201).json(mapFeedback(f));
});

router.get("/:id", async (req, res) => {
  const f = await db.get("SELECT f.*, c.name as cname FROM feedback f LEFT JOIN customers c ON c.id = f.customer_id WHERE f.id = $1", [Number(req.params.id)]) as any;
  if (!f) { res.status(404).json({ error: "not_found", message: "Avaliação não encontrada" }); return; }
  res.json(mapFeedback(f));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM feedback WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Avaliação não encontrada" }); return; }
  await db.run("DELETE FROM feedback WHERE id = $1", [id]);
  res.json({ message: "Avaliação removida com sucesso" });
});

export default router;
