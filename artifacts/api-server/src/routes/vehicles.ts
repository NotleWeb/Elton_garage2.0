import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapVehicle(v: any, customerName?: string) {
  return {
    id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model,
    year: v.year, plate: v.plate, color: v.color, fuel: v.fuel,
    mileage: v.mileage, notes: v.notes,
    customerName: customerName ?? null,
  };
}

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", search = "" } = req.query as any;
  const [vehicles, customers] = await Promise.all([getAll("vehicles"), getAll("customers")]);
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c.name]));
  const q = (search as string).toLowerCase();
  const filtered = (vehicles as any[]).filter((v: any) => {
    if (!q) return true;
    const cn = (custMap.get(v.customer_id) ?? "").toLowerCase();
    return (
      v.brand?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.plate?.toLowerCase().includes(q) ||
      cn.includes(q)
    );
  });
  filtered.sort((a: any, b: any) =>
    (custMap.get(a.customer_id) ?? "").localeCompare(custMap.get(b.customer_id) ?? "")
  );
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  const offset = (pg - 1) * lim;
  res.json({
    data: filtered.slice(offset, offset + lim).map((v: any) => mapVehicle(v, custMap.get(v.customer_id))),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

router.post("/", async (req, res) => {
  const { customerId, brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  if (!customerId || !brand || !model) {
    res.status(400).json({ error: "validation", message: "Cliente, marca e modelo sao obrigatorios" });
    return;
  }
  const customer = await getById("customers", Number(customerId)) as any;
  const vehicle = await createDoc("vehicles", {
    customer_id: Number(customerId), brand, model,
    year: year ?? null, plate: plate ?? null, color: color ?? null,
    fuel: fuel ?? null, mileage: mileage ?? null, notes: notes ?? null,
  });
  res.status(201).json(mapVehicle(vehicle, customer?.name));
});

router.get("/:id", async (req, res) => {
  const v = await getById("vehicles", Number(req.params.id)) as any;
  if (!v) { res.status(404).json({ error: "not_found", message: "Veiculo nao encontrado" }); return; }
  const customer = await getById("customers", v.customer_id) as any;
  res.json(mapVehicle(v, customer?.name));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const v = await getById("vehicles", id) as any;
  if (!v) { res.status(404).json({ error: "not_found", message: "Veiculo nao encontrado" }); return; }
  const { brand, model, year, plate, color, fuel, mileage, notes } = req.body as any;
  await updateDocById("vehicles", id, {
    brand: brand ?? v.brand, model: model ?? v.model,
    year: year ?? v.year, plate: plate ?? v.plate,
    color: color ?? v.color, fuel: fuel ?? v.fuel,
    mileage: mileage ?? v.mileage, notes: notes ?? v.notes,
  });
  const updated = await getById("vehicles", id) as any;
  const customer = await getById("customers", updated.customer_id) as any;
  res.json(mapVehicle(updated, customer?.name));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("vehicles", id)) {
    res.status(404).json({ error: "not_found", message: "Veiculo nao encontrado" });
    return;
  }
  await deleteDocById("vehicles", id);
  res.json({ message: "Veiculo removido com sucesso" });
});

export default router;
