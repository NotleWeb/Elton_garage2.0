import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById } from "../db.js";
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

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", search = "", lowStock } = req.query as any;
  const all = await getAll("products");
  const q = (search as string).toLowerCase();
  let filtered = (all as any[]).filter((p: any) =>
    !q || p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.supplier?.toLowerCase().includes(q)
  );
  if (lowStock === "true") filtered = filtered.filter((p: any) => Number(p.stock) <= Number(p.minimum_stock));
  filtered.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: filtered.slice((pg - 1) * lim, pg * lim).map(mapProduct),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

router.post("/", async (req, res) => {
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  if (!name || stock === undefined || minimumStock === undefined) {
    res.status(400).json({ error: "validation", message: "Nome, estoque e estoque minimo sao obrigatorios" });
    return;
  }
  const p = await createDoc("products", {
    name, brand: brand ?? null, supplier: supplier ?? null,
    purchase_price: purchasePrice ?? null, sale_price: salePrice ?? null,
    stock: Number(stock), minimum_stock: Number(minimumStock), unit: unit ?? "un",
  });
  res.status(201).json(mapProduct(p));
});

router.get("/:id", async (req, res) => {
  const p = await getById("products", Number(req.params.id));
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto nao encontrado" }); return; }
  res.json(mapProduct(p));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const p = await getById("products", id) as any;
  if (!p) { res.status(404).json({ error: "not_found", message: "Produto nao encontrado" }); return; }
  const { name, brand, supplier, purchasePrice, salePrice, stock, minimumStock, unit } = req.body as any;
  await updateDocById("products", id, {
    name: name ?? p.name, brand: brand ?? p.brand, supplier: supplier ?? p.supplier,
    purchase_price: purchasePrice ?? p.purchase_price, sale_price: salePrice ?? p.sale_price,
    stock: stock !== undefined ? Number(stock) : p.stock,
    minimum_stock: minimumStock !== undefined ? Number(minimumStock) : p.minimum_stock,
    unit: unit ?? p.unit,
  });
  const updated = await getById("products", id);
  res.json(mapProduct(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("products", id)) {
    res.status(404).json({ error: "not_found", message: "Produto nao encontrado" });
    return;
  }
  const [usage, movements] = await Promise.all([
    db.collection("product_usage").where("product_id", "==", id).limit(1).get(),
    db.collection("inventory_movements").where("product_id", "==", id).limit(1).get(),
  ]);
  if (!usage.empty) {
    res.status(409).json({ error: "conflict", message: "Produto possui historico de uso em agendamentos." });
    return;
  }
  if (!movements.empty) {
    res.status(409).json({ error: "conflict", message: "Produto possui movimentacoes de estoque registradas." });
    return;
  }
  await deleteDocById("products", id);
  res.json({ message: "Produto removido com sucesso" });
});

export default router;
