import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapMovement(m: any) {
  return {
    id: m.id, productId: m.product_id, movementType: m.movement_type, quantity: m.quantity,
    reason: m.reason, appointmentId: m.appointment_id, createdAt: m.created_at,
    product: m.pname ? { id: m.product_id, name: m.pname, stock: m.pstock, unit: m.punit, minimumStock: m.pmin, isLowStock: m.pstock <= m.pmin } : undefined,
  };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, productId, movementType, dateFrom, dateTo } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (productId) { where += " AND im.product_id = ?"; params.push(Number(productId)); }
  if (movementType) { where += " AND im.movement_type = ?"; params.push(movementType); }
  if (dateFrom) { where += " AND im.created_at >= ?"; params.push(dateFrom); }
  if (dateTo) { where += " AND im.created_at <= ?"; params.push(dateTo + "T23:59:59"); }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM inventory_movements im ${where}`).get(...params) as any).c;
  const data = db.prepare(`SELECT im.*, p.name as pname, p.stock as pstock, p.unit as punit, p.minimum_stock as pmin FROM inventory_movements im JOIN products p ON p.id = im.product_id ${where} ORDER BY im.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapMovement), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { productId, movementType, quantity, reason, appointmentId } = req.body as any;
  if (!productId || !movementType || quantity === undefined) { res.status(400).json({ error: "validation", message: "Produto, tipo e quantidade são obrigatórios" }); return; }
  // Update stock
  if (movementType === "entrada" || movementType === "ajuste") {
    db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(quantity, productId);
  } else if (movementType === "saida") {
    db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").run(quantity, productId);
  }
  const result = db.prepare("INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, appointment_id) VALUES (?, ?, ?, ?, ?)").run(productId, movementType, quantity, reason ?? null, appointmentId ?? null);
  const m = db.prepare("SELECT im.*, p.name as pname, p.stock as pstock, p.unit as punit, p.minimum_stock as pmin FROM inventory_movements im JOIN products p ON p.id = im.product_id WHERE im.id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapMovement(m));
});

export default router;
