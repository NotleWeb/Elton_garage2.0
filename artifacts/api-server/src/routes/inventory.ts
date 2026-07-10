import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapMovement(m: any) {
  return {
    id: m.id, productId: m.product_id, movementType: m.movement_type, quantity: Number(m.quantity),
    reason: m.reason, appointmentId: m.appointment_id, createdAt: m.created_at,
    product: m.pname ? { id: m.product_id, name: m.pname, stock: Number(m.pstock), unit: m.punit, minimumStock: Number(m.pmin), isLowStock: Number(m.pstock) <= Number(m.pmin) } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, productId, movementType, dateFrom, dateTo } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (productId) { where += ` AND im.product_id = $${params.length + 1}`; params.push(Number(productId)); }
  if (movementType) { where += ` AND im.movement_type = $${params.length + 1}`; params.push(movementType); }
  if (dateFrom) { where += ` AND im.created_at >= $${params.length + 1}`; params.push(dateFrom); }
  if (dateTo) { where += ` AND im.created_at <= $${params.length + 1}`; params.push(dateTo + "T23:59:59"); }
  const total = Number((await db.get(`SELECT COUNT(*) as c FROM inventory_movements im ${where}`, params))?.c ?? 0);
  const data = await db.all(`SELECT im.*, p.name as pname, p.stock as pstock, p.unit as punit, p.minimum_stock as pmin FROM inventory_movements im JOIN products p ON p.id = im.product_id ${where} ORDER BY im.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]);
  res.json({ data: data.map(mapMovement), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { productId, movementType, quantity, reason, appointmentId } = req.body as any;
  if (!productId || !movementType || quantity === undefined) { res.status(400).json({ error: "validation", message: "Produto, tipo e quantidade são obrigatórios" }); return; }
  if (movementType === "entrada" || movementType === "ajuste") {
    await db.run("UPDATE products SET stock = stock + $1 WHERE id = $2", [quantity, productId]);
  } else if (movementType === "saida") {
    await db.run("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2", [quantity, productId]);
  }
  const result = await db.run("INSERT INTO inventory_movements (product_id, movement_type, quantity, reason, appointment_id) VALUES ($1,$2,$3,$4,$5) RETURNING id", [productId, movementType, quantity, reason ?? null, appointmentId ?? null]);
  const m = await db.get("SELECT im.*, p.name as pname, p.stock as pstock, p.unit as punit, p.minimum_stock as pmin FROM inventory_movements im JOIN products p ON p.id = im.product_id WHERE im.id = $1", [result.id]) as any;
  res.status(201).json(mapMovement(m));
});

export default router;
