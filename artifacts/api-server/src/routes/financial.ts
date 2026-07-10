import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapTx(t: any) {
  return { id: t.id, type: t.type, category: t.category, description: t.description, amount: Number(t.amount), date: t.date, appointmentId: t.appointment_id, paymentMethod: t.payment_method, createdAt: t.created_at };
}

router.get("/summary", async (req, res) => {
  const now = new Date();
  const month = Number((req.query as any).month ?? now.getMonth() + 1);
  const year = Number((req.query as any).year ?? now.getFullYear());
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const [revRow, expRow] = await Promise.all([
    db.get("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type='receita' AND date LIKE $1", [`${prefix}%`]),
    db.get("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE $1", [`${prefix}%`]),
  ]);
  const revenue = Number((revRow as any)?.s ?? 0);
  const expenses = Number((expRow as any)?.s ?? 0);
  res.json({ totalRevenue: revenue, totalExpenses: expenses, profit: revenue - expenses, month, year });
});

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, type, dateFrom, dateTo, category } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (type) { where += ` AND type = $${params.length + 1}`; params.push(type); }
  if (dateFrom) { where += ` AND date >= $${params.length + 1}`; params.push(dateFrom); }
  if (dateTo) { where += ` AND date <= $${params.length + 1}`; params.push(dateTo); }
  if (category) { where += ` AND category = $${params.length + 1}`; params.push(category); }
  const total = Number((await db.get(`SELECT COUNT(*) as c FROM financial_transactions ${where}`, params))?.c ?? 0);
  const data = await db.all(`SELECT * FROM financial_transactions ${where} ORDER BY date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]);
  res.json({ data: data.map(mapTx), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { type, category, description, amount, date, appointmentId, paymentMethod } = req.body as any;
  if (!type || !description || amount === undefined || !date) { res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" }); return; }
  const result = await db.run("INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [type, category ?? null, description, amount, date, appointmentId ?? null, paymentMethod ?? null]);
  const tx = await db.get("SELECT * FROM financial_transactions WHERE id = $1", [result.id]) as any;
  res.status(201).json(mapTx(tx));
});

router.get("/:id", async (req, res) => {
  const tx = await db.get("SELECT * FROM financial_transactions WHERE id = $1", [Number(req.params.id)]) as any;
  if (!tx) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  res.json(mapTx(tx));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tx = await db.get("SELECT * FROM financial_transactions WHERE id = $1", [id]) as any;
  if (!tx) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  const { type, category, description, amount, date, paymentMethod } = req.body as any;
  await db.run("UPDATE financial_transactions SET type=$1, category=$2, description=$3, amount=$4, date=$5, payment_method=$6 WHERE id=$7", [type ?? tx.type, category ?? tx.category, description ?? tx.description, amount ?? tx.amount, date ?? tx.date, paymentMethod ?? tx.payment_method, id]);
  const updated = await db.get("SELECT * FROM financial_transactions WHERE id = $1", [id]) as any;
  res.json(mapTx(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM financial_transactions WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  await db.run("DELETE FROM financial_transactions WHERE id = $1", [id]);
  res.json({ message: "Transação removida com sucesso" });
});

export default router;
