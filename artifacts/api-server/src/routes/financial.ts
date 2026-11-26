import { Router } from "express";
import { getAll, getById, createDoc, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapTx(t: any) {
  return {
    id: t.id, type: t.type, category: t.category, description: t.description,
    amount: Number(t.amount), date: t.date,
    appointmentId: t.appointment_id ?? null,
    paymentMethod: t.payment_method ?? null,
    createdAt: t.created_at,
  };
}

// GET /financial/summary/monthly - must come before /:id
router.get("/summary/monthly", async (_req, res) => {
  const transactions = await getAll("financial_transactions") as any[];
  // Group by YYYY-MM
  const byMonth: Record<string, { revenue: number; expenses: number }> = {};
  for (const t of transactions) {
    const month = (t.date ?? "").slice(0, 7);
    if (!month) continue;
    if (!byMonth[month]) byMonth[month] = { revenue: 0, expenses: 0 };
    if (t.type === "receita") byMonth[month].revenue += Number(t.amount);
    else byMonth[month].expenses += Number(t.amount);
  }
  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, expenses: v.expenses, net: v.revenue - v.expenses }));
  res.json(rows);
});

// GET /financial
router.get("/", async (req, res) => {
  const { page = "1", limit = "20", type, search = "", startDate, endDate } = req.query as any;
  const all = await getAll("financial_transactions") as any[];
  const q = (search as string).toLowerCase();
  let filtered = all.filter((t: any) => {
    if (type && t.type !== type) return false;
    if (q && !t.description?.toLowerCase().includes(q) && !t.category?.toLowerCase().includes(q)) return false;
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });
  filtered.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const total = filtered.length;
  const totalRevenue = filtered.filter((t: any) => t.type === "receita").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpenses = filtered.filter((t: any) => t.type === "despesa").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: filtered.slice((pg - 1) * lim, pg * lim).map(mapTx),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
    summary: { totalRevenue, totalExpenses, net: totalRevenue - totalExpenses },
  });
});

// POST /financial
router.post("/", async (req, res) => {
  const { type, category, description, amount, date, appointmentId, paymentMethod } = req.body as any;
  if (!type || !amount || !date) {
    res.status(400).json({ error: "validation", message: "Tipo, valor e data sao obrigatorios" });
    return;
  }
  const t = await createDoc("financial_transactions", {
    type, category: category ?? null, description: description ?? null,
    amount: Number(amount), date, appointment_id: appointmentId ?? null,
    payment_method: paymentMethod ?? null, created_at: nowIso(),
  });
  res.status(201).json(mapTx(t));
});

// GET /financial/:id
router.get("/:id", async (req, res) => {
  const t = await getById("financial_transactions", Number(req.params.id));
  if (!t) { res.status(404).json({ error: "not_found", message: "Transacao nao encontrada" }); return; }
  res.json(mapTx(t));
});

// PUT /financial/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const t = await getById("financial_transactions", id) as any;
  if (!t) { res.status(404).json({ error: "not_found", message: "Transacao nao encontrada" }); return; }
  const { type, category, description, amount, date, appointmentId, paymentMethod } = req.body as any;
  await updateDocById("financial_transactions", id, {
    type: type ?? t.type, category: category ?? t.category,
    description: description ?? t.description, amount: amount !== undefined ? Number(amount) : t.amount,
    date: date ?? t.date, appointment_id: appointmentId ?? t.appointment_id,
    payment_method: paymentMethod ?? t.payment_method,
  });
  const updated = await getById("financial_transactions", id);
  res.json(mapTx(updated));
});

// DELETE /financial/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("financial_transactions", id)) {
    res.status(404).json({ error: "not_found", message: "Transacao nao encontrada" }); return;
  }
  await deleteDocById("financial_transactions", id);
  res.json({ message: "Transacao removida com sucesso" });
});

export default router;
