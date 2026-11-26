import { Router } from "express";
import { db, getAll, getById, nextId, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapProduct(p: any) {
  return {
    id: p.id, name: p.name, brand: p.brand, supplier: p.supplier,
    purchasePrice: Number(p.purchase_price ?? 0), salePrice: Number(p.sale_price ?? 0),
    stock: Number(p.stock), minimumStock: Number(p.minimum_stock), unit: p.unit,
    isLowStock: Number(p.stock) <= Number(p.minimum_stock),
  };
}

// GET /inventory - list movements
router.get("/", async (req, res) => {
  const { page = "1", limit = "20", productId } = req.query as any;
  let movements: any[];
  if (productId) {
    const snap = await db.collection("inventory_movements").where("product_id", "==", Number(productId)).get();
    movements = snap.docs.map((d) => ({ id: Number(d.id), ...d.data() }));
  } else {
    movements = await getAll("inventory_movements") as any[];
  }
  const products = await getAll("products");
  const prodMap = new Map((products as any[]).map((p: any) => [p.id, p]));
  movements.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const total = movements.length;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: movements.slice((pg - 1) * lim, pg * lim).map((m) => ({
      id: m.id, productId: m.product_id, type: m.type, quantity: m.quantity,
      reason: m.reason, createdAt: m.created_at,
      product: prodMap.has(m.product_id) ? mapProduct(prodMap.get(m.product_id)) : undefined,
    })),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

// POST /inventory - atomic: stock update + movement record
router.post("/", async (req, res) => {
  const { productId, type, quantity, reason } = req.body as any;
  if (!productId || !type || quantity === undefined) {
    res.status(400).json({ error: "validation", message: "Produto, tipo e quantidade sao obrigatorios" });
    return;
  }
  const product = await getById("products", Number(productId)) as any;
  if (!product) { res.status(404).json({ error: "not_found", message: "Produto nao encontrado" }); return; }
  const qty = Number(quantity);
  const delta = type === "entrada" ? qty : -qty;
  const newStock = Number(product.stock) + delta;
  if (newStock < 0) { res.status(400).json({ error: "stock", message: "Estoque insuficiente" }); return; }

  // Atomic batch: update stock + create movement
  const movId = await nextId("inventory_movements");
  const batch = db.batch();
  batch.update(db.collection("products").doc(String(Number(productId))), { stock: newStock });
  batch.set(db.collection("inventory_movements").doc(String(movId)), {
    product_id: Number(productId), type, quantity: qty, reason: reason ?? null, created_at: nowIso(),
  });
  await batch.commit();

  const updated = await getById("products", Number(productId));
  res.status(201).json({ product: mapProduct(updated), movement: { id: movId, productId, type, quantity: qty, reason } });
});

// GET /inventory/low-stock
router.get("/low-stock", async (_req, res) => {
  const products = await getAll("products");
  const low = (products as any[]).filter((p: any) => Number(p.stock) <= Number(p.minimum_stock));
  res.json({ data: low.map(mapProduct), total: low.length });
});

export default router;
