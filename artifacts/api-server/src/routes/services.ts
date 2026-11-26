import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapService(s: any) {
  return {
    id: s.id, name: s.name, description: s.description,
    price: Number(s.price), estimatedDuration: s.estimated_duration,
    category: s.category, vehicleType: s.vehicle_type, active: !!s.active,
  };
}

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", search = "", category, active } = req.query as any;
  const all = await getAll("services");
  const q = (search as string).toLowerCase();
  let filtered = (all as any[]).filter((s: any) =>
    !q || s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
  );
  if (category) filtered = filtered.filter((s: any) => s.category === category);
  if (active !== undefined) filtered = filtered.filter((s: any) => s.active === (active === "true" ? 1 : 0));
  filtered.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: filtered.slice((pg - 1) * lim, pg * lim).map(mapService),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

router.post("/", async (req, res) => {
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  if (!name || price === undefined) {
    res.status(400).json({ error: "validation", message: "Nome e preco sao obrigatorios" });
    return;
  }
  const s = await createDoc("services", {
    name, description: description ?? null, price: Number(price),
    estimated_duration: estimatedDuration ?? null, category: category ?? null,
    vehicle_type: vehicleType ?? "todos", active: active !== undefined ? (active ? 1 : 0) : 1,
  });
  res.status(201).json(mapService(s));
});

router.get("/:id", async (req, res) => {
  const s = await getById("services", Number(req.params.id));
  if (!s) { res.status(404).json({ error: "not_found", message: "Servico nao encontrado" }); return; }
  res.json(mapService(s));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const s = await getById("services", id) as any;
  if (!s) { res.status(404).json({ error: "not_found", message: "Servico nao encontrado" }); return; }
  const { name, description, price, estimatedDuration, category, vehicleType, active } = req.body as any;
  await updateDocById("services", id, {
    name: name ?? s.name, description: description ?? s.description,
    price: price !== undefined ? Number(price) : s.price,
    estimated_duration: estimatedDuration ?? s.estimated_duration,
    category: category ?? s.category, vehicle_type: vehicleType ?? s.vehicle_type,
    active: active !== undefined ? (active ? 1 : 0) : s.active,
  });
  const updated = await getById("services", id);
  res.json(mapService(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("services", id)) {
    res.status(404).json({ error: "not_found", message: "Servico nao encontrado" });
    return;
  }
  const linked = await db.collection("appointment_services").where("service_id", "==", id).limit(1).get();
  if (!linked.empty) {
    res.status(409).json({ error: "conflict", message: "Servico vinculado a agendamentos e nao pode ser excluido." });
    return;
  }
  await deleteDocById("services", id);
  res.json({ message: "Servico removido com sucesso" });
});

export default router;
