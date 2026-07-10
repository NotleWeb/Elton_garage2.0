import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapNotification(n: any) {
  return {
    id: n.id, customerId: n.customer_id, title: n.title, message: n.message, type: n.type,
    read: !!n.read, createdAt: n.created_at,
    customer: n.cname ? { id: n.customer_id, name: n.cname } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, read } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (read !== undefined) { where += ` AND n.read = $${params.length + 1}`; params.push(read === "true" ? 1 : 0); }
  const [countRow, unreadRow, data] = await Promise.all([
    db.get(`SELECT COUNT(*) as c FROM notifications n ${where}`, params),
    db.get("SELECT COUNT(*) as c FROM notifications WHERE read = 0"),
    db.all(`SELECT n.*, c.name as cname FROM notifications n LEFT JOIN customers c ON c.id = n.customer_id ${where} ORDER BY n.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]),
  ]);
  const total = Number((countRow as any)?.c ?? 0);
  const unreadCount = Number((unreadRow as any)?.c ?? 0);
  res.json({ data: data.map(mapNotification), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }, unreadCount });
});

router.patch("/read-all", async (_req, res) => {
  await db.run("UPDATE notifications SET read = 1 WHERE read = 0");
  res.json({ message: "Todas as notificações marcadas como lidas" });
});

router.patch("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const n = await db.get("SELECT * FROM notifications WHERE id = $1", [id]) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificação não encontrada" }); return; }
  await db.run("UPDATE notifications SET read = 1 WHERE id = $1", [id]);
  const updated = await db.get("SELECT n.*, c.name as cname FROM notifications n LEFT JOIN customers c ON c.id = n.customer_id WHERE n.id = $1", [id]) as any;
  res.json(mapNotification(updated));
});

export default router;
