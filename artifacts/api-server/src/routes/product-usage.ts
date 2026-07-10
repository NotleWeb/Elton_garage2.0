import { Router } from "express";
import { db, getById, createDoc, deleteDocById, updateDocById, nextId, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

// GET /appointments/:appointmentId/product-usage
router.get("/", async (req, res) => {
  const aptId = Number((req.params as any).appointmentId);
  const snap = await db.collection("product_usage").where("appointment_id", "==", aptId).get();
  const usages = snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })) as any[];
  const products = await Promise.all(usages.map((u) => getById("products", u.product_id)));
  const prodMap = new Map((products.filter(Boolean) as any[]).map((p: any) => [p.id, p]));
  res.json(usages.map((u) => {
    const p = prodMap.get(u.product_id) as any;
    return {
      id: u.id, appointmentId: u.appointment_id, productId: u.product_id,
      quantity: u.quantity, createdAt: u.created_at,
      product: p ? { id: p.id, name: p.name, brand: p.brand, unit: p.unit, salePrice: Number(p.sale_price ?? 0) } : undefined,
    };
  }));
});

// POST /appointments/:appointmentId/product-usage — atomic batch
router.post("/", async (req, res) => {
  const aptId = Number((req.params as any).appointmentId);
  const { productId, quantity } = req.body as any;
  if (!productId || !quantity) {
    res.status(400).json({ error: "validation", message: "Produto e quantidade sao obrigatorios" }); return;
  }
  const product = await getById("products", Number(productId)) as any;
  if (!product) { res.status(404).json({ error: "not_found", message: "Produto nao encontrado" }); return; }
  const qty = Number(quantity);
  const newStock = Number(product.stock) - qty;
  if (newStock < 0) { res.status(400).json({ error: "stock", message: "Estoque insuficiente" }); return; }

  // Atomic batch: deduct stock + create movement + create usage record
  const [usageId, movId] = await Promise.all([nextId("product_usage"), nextId("inventory_movements")]);
  const batch = db.batch();
  batch.update(db.collection("products").doc(String(Number(productId))), { stock: newStock });
  batch.set(db.collection("inventory_movements").doc(String(movId)), {
    product_id: Number(productId), type: "saida", quantity: qty, reason: `Uso em OS #${aptId}`, created_at: nowIso(),
  });
  batch.set(db.collection("product_usage").doc(String(usageId)), {
    appointment_id: aptId, product_id: Number(productId), quantity: qty, created_at: nowIso(),
  });
  await batch.commit();

  res.status(201).json({
    id: usageId, appointmentId: aptId, productId: Number(productId), quantity: qty,
    product: { id: product.id, name: product.name, brand: product.brand, unit: product.unit, salePrice: Number(product.sale_price ?? 0) },
  });
});

// DELETE /appointments/:appointmentId/product-usage/:usageId — restore stock atomically
router.delete("/:usageId", async (req, res) => {
  const usageId = Number(req.params.usageId);
  const usage = await getById("product_usage", usageId) as any;
  if (!usage) { res.status(404).json({ error: "not_found", message: "Registro de uso nao encontrado" }); return; }
  const product = await getById("products", usage.product_id) as any;

  if (product) {
    const movId = await nextId("inventory_movements");
    const batch = db.batch();
    batch.update(db.collection("products").doc(String(usage.product_id)), {
      stock: Number(product.stock) + Number(usage.quantity),
    });
    batch.set(db.collection("inventory_movements").doc(String(movId)), {
      product_id: usage.product_id, type: "entrada", quantity: Number(usage.quantity),
      reason: `Estorno de uso em OS #${usage.appointment_id}`, created_at: nowIso(),
    });
    batch.delete(db.collection("product_usage").doc(String(usageId)));
    await batch.commit();
  } else {
    await deleteDocById("product_usage", usageId);
  }

  res.json({ message: "Uso de produto removido e estoque restaurado" });
});

export default router;
