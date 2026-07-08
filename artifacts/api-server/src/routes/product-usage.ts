import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapProduct(p: any) {
  if (!p) return undefined;
  return { id: p.id, name: p.name, brand: p.brand, stock: p.stock, minimumStock: p.minimum_stock, unit: p.unit, isLowStock: p.stock <= p.minimum_stock };
}

export function registerProductUsageRoutes(parentRouter: Router) {
  parentRouter.get("/:id/product-usage", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const usages = db.prepare("SELECT pu.*, p.name as pname, p.brand as pbrand, p.stock as pstock, p.minimum_stock as pmin, p.unit as punit FROM product_usage pu JOIN products p ON p.id = pu.product_id WHERE pu.appointment_id = ?").all(id);
    res.json(usages.map((u: any) => ({
      id: u.id, appointmentId: u.appointment_id, productId: u.product_id, quantity: u.quantity,
      product: { id: u.product_id, name: u.pname, brand: u.pbrand, stock: u.pstock, minimumStock: u.pmin, unit: u.punit, isLowStock: u.pstock <= u.pmin },
    })));
  });

  parentRouter.post("/:id/product-usage", authMiddleware, (req, res) => {
    const appointmentId = Number(req.params.id);
    const { productId, quantity } = req.body as any;
    if (!productId || quantity === undefined) { res.status(400).json({ error: "validation", message: "Produto e quantidade são obrigatórios" }); return; }
    const result = db.prepare("INSERT INTO product_usage (appointment_id, product_id, quantity) VALUES (?, ?, ?)").run(appointmentId, productId, quantity);
    const u = db.prepare("SELECT pu.*, p.name as pname, p.brand as pbrand, p.stock as pstock, p.minimum_stock as pmin, p.unit as punit FROM product_usage pu JOIN products p ON p.id = pu.product_id WHERE pu.id = ?").get(result.lastInsertRowid) as any;
    res.status(201).json({ id: u.id, appointmentId: u.appointment_id, productId: u.product_id, quantity: u.quantity, product: { id: u.product_id, name: u.pname, brand: u.pbrand, stock: u.pstock, minimumStock: u.pmin, unit: u.punit, isLowStock: u.pstock <= u.pmin } });
  });
}

// Standalone delete by product usage ID
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT * FROM product_usage WHERE id = ?").get(id)) { res.status(404).json({ error: "not_found", message: "Registro não encontrado" }); return; }
  db.prepare("DELETE FROM product_usage WHERE id = ?").run(id);
  res.json({ message: "Registro removido com sucesso" });
});

export default router;
