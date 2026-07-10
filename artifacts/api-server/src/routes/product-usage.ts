import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapUsage(u: any) {
  return {
    id: u.id, appointmentId: u.appointment_id, productId: u.product_id, quantity: Number(u.quantity),
    product: { id: u.product_id, name: u.pname, brand: u.pbrand, stock: Number(u.pstock), minimumStock: Number(u.pmin), unit: u.punit, isLowStock: Number(u.pstock) <= Number(u.pmin) },
  };
}

export function registerProductUsageRoutes(parentRouter: Router) {
  parentRouter.get("/:id/product-usage", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const usages = await db.all("SELECT pu.*, p.name as pname, p.brand as pbrand, p.stock as pstock, p.minimum_stock as pmin, p.unit as punit FROM product_usage pu JOIN products p ON p.id = pu.product_id WHERE pu.appointment_id = $1", [id]);
    res.json(usages.map(mapUsage));
  });

  parentRouter.post("/:id/product-usage", authMiddleware, async (req, res) => {
    const appointmentId = Number(req.params.id);
    const { productId, quantity } = req.body as any;
    if (!productId || quantity === undefined) { res.status(400).json({ error: "validation", message: "Produto e quantidade são obrigatórios" }); return; }
    const result = await db.run("INSERT INTO product_usage (appointment_id, product_id, quantity) VALUES ($1,$2,$3) RETURNING id", [appointmentId, productId, quantity]);
    const u = await db.get("SELECT pu.*, p.name as pname, p.brand as pbrand, p.stock as pstock, p.minimum_stock as pmin, p.unit as punit FROM product_usage pu JOIN products p ON p.id = pu.product_id WHERE pu.id = $1", [result.id]) as any;
    res.status(201).json(mapUsage(u));
  });
}

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM product_usage WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Registro não encontrado" }); return; }
  await db.run("DELETE FROM product_usage WHERE id = $1", [id]);
  res.json({ message: "Registro removido com sucesso" });
});

export default router;
