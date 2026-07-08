import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapTx(t: any) {
  return { id: t.id, type: t.type, category: t.category, description: t.description, amount: t.amount, date: t.date, appointmentId: t.appointment_id, paymentMethod: t.payment_method, createdAt: t.created_at };
}

// IMPORTANT: /summary must come before /:id to avoid route conflict
router.get("/summary", (req, res) => {
  const now = new Date();
  const month = Number((req.query as any).month ?? now.getMonth() + 1);
  const year = Number((req.query as any).year ?? now.getFullYear());
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;
  const revenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type='receita' AND date LIKE ?").get(`${prefix}%`) as any).s;
  const expenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type='despesa' AND date LIKE ?").get(`${prefix}%`) as any).s;
  res.json({ totalRevenue: revenue, totalExpenses: expenses, profit: revenue - expenses, month, year });
});

router.get("/", (req, res) => {
  const { page = 1, limit = 20, type, dateFrom, dateTo, category } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (type) { where += " AND type = ?"; params.push(type); }
  if (dateFrom) { where += " AND date >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND date <= ?"; params.push(dateTo); }
  if (category) { where += " AND category = ?"; params.push(category); }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM financial_transactions ${where}`).get(...params) as any).c;
  const data = db.prepare(`SELECT * FROM financial_transactions ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapTx), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { type, category, description, amount, date, appointmentId, paymentMethod } = req.body as any;
  if (!type || !description || amount === undefined || !date) { res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" }); return; }
  const result = db.prepare("INSERT INTO financial_transactions (type, category, description, amount, date, appointment_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)").run(type, category ?? null, description, amount, date, appointmentId ?? null, paymentMethod ?? null);
  const tx = db.prepare("SELECT * FROM financial_transactions WHERE id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapTx(tx));
});

router.get("/:id", (req, res) => {
  const tx = db.prepare("SELECT * FROM financial_transactions WHERE id = ?").get(Number(req.params.id)) as any;
  if (!tx) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  res.json(mapTx(tx));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const tx = db.prepare("SELECT * FROM financial_transactions WHERE id = ?").get(id) as any;
  if (!tx) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  const { type, category, description, amount, date, paymentMethod } = req.body as any;
  db.prepare("UPDATE financial_transactions SET type=?, category=?, description=?, amount=?, date=?, payment_method=? WHERE id=?").run(type ?? tx.type, category ?? tx.category, description ?? tx.description, amount ?? tx.amount, date ?? tx.date, paymentMethod ?? tx.payment_method, id);
  const updated = db.prepare("SELECT * FROM financial_transactions WHERE id = ?").get(id) as any;
  res.json(mapTx(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM financial_transactions WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Transação não encontrada" }); return; }
  db.prepare("DELETE FROM financial_transactions WHERE id = ?").run(id);
  res.json({ message: "Transação removida com sucesso" });
});

export default router;
