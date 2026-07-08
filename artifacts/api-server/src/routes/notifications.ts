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

router.get("/", (req, res) => {
  const { page = 1, limit = 20, read } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (read !== undefined) { where += " AND n.read = ?"; params.push(read === "true" ? 1 : 0); }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM notifications n ${where}`).get(...params) as any).c;
  const unreadCount = (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE read = 0").get() as any).c;
  const data = db.prepare(`SELECT n.*, c.name as cname FROM notifications n LEFT JOIN customers c ON c.id = n.customer_id ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapNotification), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }, unreadCount });
});

// IMPORTANT: /read-all must come before /:id
router.patch("/read-all", (_req, res) => {
  db.prepare("UPDATE notifications SET read = 1 WHERE read = 0").run();
  res.json({ message: "Todas as notificações marcadas como lidas" });
});

router.patch("/:id/read", (req, res) => {
  const id = Number(req.params.id);
  const n = db.prepare("SELECT * FROM notifications WHERE id = ?").get(id) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificação não encontrada" }); return; }
  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
  const updated = db.prepare("SELECT n.*, c.name as cname FROM notifications n LEFT JOIN customers c ON c.id = n.customer_id WHERE n.id = ?").get(id) as any;
  res.json(mapNotification(updated));
});

export default router;
