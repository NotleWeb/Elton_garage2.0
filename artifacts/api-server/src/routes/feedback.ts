import { Router } from "express";
import { getAll, getById, createDoc, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function toFeedback(f: any, custMap: Map<number, any>) {
  const c = custMap.get(f.customer_id);
  return {
    id: f.id, customerId: f.customer_id, appointmentId: f.appointment_id,
    rating: f.rating, comment: f.comment, createdAt: f.created_at,
    customer: c ? { id: c.id, name: c.name } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = "1", limit = "20" } = req.query as any;
  const [feedbacks, customers] = await Promise.all([getAll("feedback"), getAll("customers")]);
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  const sorted = (feedbacks as any[]).sort((a: any, b: any) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const total = sorted.length;
  const avgRating = total > 0 ? sorted.reduce((s: number, f: any) => s + Number(f.rating), 0) / total : 0;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: sorted.slice((pg - 1) * lim, pg * lim).map((f: any) => toFeedback(f, custMap as any)),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
    averageRating: avgRating,
  });
});

router.post("/", async (req, res) => {
  const { customerId, appointmentId, rating, comment } = req.body as any;
  if (!customerId || !rating) {
    res.status(400).json({ error: "validation", message: "Cliente e avaliacao sao obrigatorios" });
    return;
  }
  const f = await createDoc("feedback", {
    customer_id: Number(customerId),
    appointment_id: appointmentId ? Number(appointmentId) : null,
    rating: Number(rating), comment: comment ?? null, created_at: nowIso(),
  });
  const customers = await getAll("customers");
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  res.status(201).json(toFeedback(f, custMap as any));
});

router.get("/:id", async (req, res) => {
  const f = await getById("feedback", Number(req.params.id));
  if (!f) { res.status(404).json({ error: "not_found", message: "Avaliacao nao encontrada" }); return; }
  const customers = await getAll("customers");
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  res.json(toFeedback(f, custMap as any));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("feedback", id)) {
    res.status(404).json({ error: "not_found", message: "Avaliacao nao encontrada" });
    return;
  }
  await deleteDocById("feedback", id);
  res.json({ message: "Avaliacao removida com sucesso" });
});

export default router;
