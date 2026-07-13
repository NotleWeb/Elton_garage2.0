import { Router } from "express";
import { db, getAll, getById, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDue(n: any): boolean {
  if (!n.scheduled_for) return true;
  return new Date(n.scheduled_for) <= new Date();
}

function formatNotification(n: any, custMap: Map<number, string>) {
  return {
    id: n.id,
    customerId: n.customer_id,
    appointmentId: n.appointment_id,
    title: n.title,
    message: n.message,
    type: n.type,
    subtype: n.subtype,
    read: !!n.read,
    readAt: n.read_at ?? null,
    completed: !!n.completed,
    completedAt: n.completed_at ?? null,
    archived: !!n.archived,
    scheduledFor: n.scheduled_for ?? null,
    createdAt: n.created_at,
    customer: n.customer_id ? { id: n.customer_id, name: custMap.get(n.customer_id) } : undefined,
  };
}

// ---------------------------------------------------------------------------
// GET /notifications
// ---------------------------------------------------------------------------

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", read, type, customerId, dateFrom, dateTo } = req.query as any;

  const [notifications, customers] = await Promise.all([
    getAll("notifications"),
    getAll("customers"),
  ]);

  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  const now = new Date();

  let filtered = (notifications as any[]).filter((n) => {
    // Exclude archived
    if (n.archived) return false;
    // Only return due notifications (scheduled_for <= now or no schedule)
    if (n.scheduled_for && new Date(n.scheduled_for) > now) return false;
    return true;
  });

  if (read !== undefined) {
    filtered = filtered.filter((n) => n.read === (read === "true" ? 1 : 0));
  }
  if (type) {
    filtered = filtered.filter((n) => n.type === type);
  }
  if (customerId) {
    filtered = filtered.filter((n) => n.customer_id === Number(customerId));
  }
  if (dateFrom) {
    filtered = filtered.filter((n) => (n.created_at ?? "") >= dateFrom);
  }
  if (dateTo) {
    filtered = filtered.filter((n) => (n.created_at ?? "") <= dateTo + "T23:59:59");
  }

  filtered.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const total = filtered.length;
  // Unread count across ALL due, non-archived notifications (ignoring page/type filters)
  const unreadCount = (notifications as any[]).filter(
    (n) => !n.read && !n.archived && isDue(n),
  ).length;

  const pg = Number(page);
  const lim = Number(limit);
  const data = filtered
    .slice((pg - 1) * lim, pg * lim)
    .map((n) => formatNotification(n, custMap));

  res.json({ data, meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) }, unreadCount });
});

// ---------------------------------------------------------------------------
// GET /notifications/:id
// ---------------------------------------------------------------------------

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const n = (await getById("notifications", id)) as any;
  if (!n) {
    res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" });
    return;
  }

  const customers = await getAll("customers") as any[];
  const custMap = new Map(customers.map((c: any) => [c.id, c.name]));
  res.json(formatNotification(n, custMap));
});

// ---------------------------------------------------------------------------
// PATCH /notifications/read-all
// ---------------------------------------------------------------------------

router.patch("/read-all", async (_req, res) => {
  const all = (await getAll("notifications")) as any[];
  const due = all.filter((n) => !n.read && !n.archived && isDue(n));
  await Promise.all(
    due.map((n) => updateDocById("notifications", n.id, { read: 1, read_at: nowIso() })),
  );
  res.json({ message: "Todas as notificacoes marcadas como lidas" });
});

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/read
// ---------------------------------------------------------------------------

router.patch("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const n = (await getById("notifications", id)) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" }); return; }
  await updateDocById("notifications", id, { read: 1, read_at: nowIso() });
  const [updated, customers] = await Promise.all([
    getById("notifications", id),
    getAll("customers"),
  ]) as any[];
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  res.json(formatNotification(updated, custMap));
});

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/complete
// ---------------------------------------------------------------------------

router.patch("/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  const n = (await getById("notifications", id)) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" }); return; }
  const ts = nowIso();
  await updateDocById("notifications", id, {
    completed: 1,
    completed_at: ts,
    read: 1,
    read_at: n.read_at ?? ts,
  });
  const [updated, customers] = await Promise.all([
    getById("notifications", id),
    getAll("customers"),
  ]) as any[];
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  res.json(formatNotification(updated, custMap));
});

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/archive
// ---------------------------------------------------------------------------

router.patch("/:id/archive", async (req, res) => {
  const id = Number(req.params.id);
  const n = (await getById("notifications", id)) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" }); return; }
  const ts = nowIso();
  await updateDocById("notifications", id, {
    archived: 1,
    read: 1,
    read_at: n.read_at ?? ts,
  });
  res.json({ message: "Notificacao arquivada com sucesso" });
});

// ---------------------------------------------------------------------------
// DELETE /notifications/:id
// ---------------------------------------------------------------------------

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const n = (await getById("notifications", id)) as any;
  if (!n) { res.status(404).json({ error: "not_found", message: "Notificacao nao encontrada" }); return; }
  await deleteDocById("notifications", id);
  res.json({ message: "Notificacao removida com sucesso" });
});

export default router;
