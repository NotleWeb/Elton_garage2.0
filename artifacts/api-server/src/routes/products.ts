import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapProduct(p: any) {
  return { id: p.id, name: p.name, brand: p.brand, supplier: p.supplier, purchasePrice: Number(p.purchase_price), salePrice: Number(p.sale_price), stock: Number(p.stock), minimumStock: Number(p.minimum_stock), unit: p.unit, isLowStock: Number(p.stock) <= Number(p.minimum_stock) };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "", lowStock } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = "WHERE (name ILIKE $1 OR brand ILIKE $2 OR supplier ILIKE $3)";
  const params: any[] = [like, like, like];
  if (lowStock === "true") { where += " AND stock <= minimum_stock"; }
  const total = Number((await db.get(`SELECT COUNT(*) as c FROM products ${where}`, params))?.c ?? 0);
  const data = await db.all(`SELECT * FROM products ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]);
  res.json({ data: data.map(mapProduct), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  if (!name || stock === undefined || minimumStock === undefined) { res.status(400).json({ error: "validation", message: "Nome, estoque e estoque mínimo são obrigatórios" }); return; }
  const result = await db.run("INSERT INTO products (name, brand, supplier, purchase_price, sale_price, stock, minimum_stock, unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [name, brand ?? null, supplier ?? null, purchasePrice ?? null, salePrice ?? null, stock, minimumStock, unit ?? "un"]);
  const p = await db.get("SELECT * FROM products WHERE id = $1", [result.id]) as any;
  res.status(201).json(mapProduct(p));
});

router.get("/:id", async (req, res) => {
  const p = await db.get("SELECT * FROM products WHERE id = $1", [Number(req.params.id)]) as any;
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  res.json(mapProduct(p));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const p = await db.get("SELECT * FROM products WHERE id = $1", [id]) as any;
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  await db.run("UPDATE products SET name=$1, brand=$2, supplier=$3, purchase_price=$4, sale_price=$5, stock=$6, minimum_stock=$7, unit=$8 WHERE id=$9", [name ?? p.name, brand ?? p.brand, supplier ?? p.supplier, purchasePrice ?? p.purchase_price, salePrice ?? p.sale_price, stock ?? p.stock, minimumStock ?? p.minimum_stock, unit ?? p.unit, id]);
  const updated = await db.get("SELECT * FROM products WHERE id = $1", [id]) as any;
  res.json(mapProduct(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM products WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  const [hasUsage, hasMovements] = await Promise.all([
    db.get("SELECT id FROM product_usage WHERE product_id = $1 LIMIT 1", [id]),
    db.get("SELECT id FROM inventory_movements WHERE product_id = $1 LIMIT 1", [id]),
  ]);
  if (hasUsage) { res.status(409).json({ error: "conflict", message: "Produto possui histórico de uso em agendamentos e não pode ser excluído." }); return; }
  if (hasMovements) { res.status(409).json({ error: "conflict", message: "Produto possui movimentações de estoque registradas e não pode ser excluído." }); return; }
  await db.run("DELETE FROM products WHERE id = $1", [id]);
  res.json({ message: "Produto removido com sucesso" });
});

export default router;
