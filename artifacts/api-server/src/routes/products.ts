import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapProduct(p: any) {
  return { id: p.id, name: p.name, brand: p.brand, supplier: p.supplier, purchasePrice: p.purchase_price, salePrice: p.sale_price, stock: p.stock, minimumStock: p.minimum_stock, unit: p.unit, isLowStock: p.stock <= p.minimum_stock };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "", lowStock } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  let where = "WHERE (name LIKE ? OR brand LIKE ? OR supplier LIKE ?)";
  const params: any[] = [like, like, like];
  if (lowStock === "true") { where += " AND stock <= minimum_stock"; }
  const total = (db.prepare(`SELECT COUNT(*) as c FROM products ${where}`).get(...params) as any).c;
  const data = db.prepare(`SELECT * FROM products ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ data: data.map(mapProduct), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  if (!name || stock === undefined || minimumStock === undefined) { res.status(400).json({ error: "validation", message: "Nome, estoque e estoque mínimo são obrigatórios" }); return; }
  const result = db.prepare("INSERT INTO products (name, brand, supplier, purchase_price, sale_price, stock, minimum_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(name, brand ?? null, supplier ?? null, purchasePrice ?? null, salePrice ?? null, stock, minimumStock, unit ?? "un");
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid) as any;
  res.status(201).json(mapProduct(p));
});

router.get("/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id)) as any;
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  res.json(mapProduct(p));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  db.prepare("UPDATE products SET name=?, brand=?, supplier=?, purchase_price=?, sale_price=?, stock=?, minimum_stock=?, unit=? WHERE id=?").run(name ?? p.name, brand ?? p.brand, supplier ?? p.supplier, purchasePrice ?? p.purchase_price, salePrice ?? p.sale_price, stock ?? p.stock, minimumStock ?? p.minimum_stock, unit ?? p.unit, id);
  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  res.json(mapProduct(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM products WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Produto não encontrado" }); return; }
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  res.json({ message: "Produto removido com sucesso" });
});

export default router;
