import { Router } from "express";
import { getAll, getById, updateDocById } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", read } = req.query as any;
  const [notifications, customers] = await Promise.all([getAll("notifications"), getAll("customers")]);
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  let filtered = notifications as any[];
  if (read !== undefined) filtered = filtered.filter((n: any) => n.read === (read === "true" ? 1 : 0));
  filtered.sort((a: any, b: any) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const total = filtered.length;
  const unreadCount = (notifications as any[]).filter((n: any) => !n.read).length;
  const pg = Number(page);
  const lim = Number(limit);
  const data = filtered.slice((pg - 1) * lim, pg * lim).map((n: any) => ({
    id: n.id, customerId: n.customer_id, title: n.title, message: n.message,
    type: n.type, read: !!n.read, createdAt: n.created_at,
    customer: n.customer_id ? { id: n.customer_id, name: custMap.get(n.customer_id) } : undefined,
  }));
  res.json({ data, meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) }, unreadCount });
});

router.patch("/read-all", async (_req, res) => {
  const all = await getAll("notifications") as any[];
  await Promise.all(all.filter((n: any) => !n.read).map((n: any) => updateDocById("notifications", n.id, { read: 1 })));
  res.json({ message: "Todas as notificacoes marcadas como lidas" });
});

router.patch("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const n = await getById("notifications", id) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" }); return; }
  await updateDocById("notifications", id, { read: 1 });
  const [updated, customers] = await Promise.all([getById("notifications", id), getAll("customers")]) as any[];
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  res.json({
    id: updated.id, customerId: updated.customer_id, title: updated.title,
    message: updated.message, type: updated.type, read: !!updated.read, createdAt: updated.created_at,
    customer: updated.customer_id ? { id: updated.customer_id, name: custMap.get(updated.customer_id) } : undefined,
  });
});

export default router;
