import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapCustomer(c: any) {
  return {
    id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp,
    email: c.email, address: c.address, notes: c.notes,
    totalSpent: Number(c.total_spent ?? 0), totalServices: Number(c.total_services ?? 0),
    lastServiceDate: c.last_service_date, createdAt: c.created_at, updatedAt: c.updated_at,
  };
}

// GET /customers
router.get("/", async (req, res) => {
  const { page = "1", limit = "20", search = "" } = req.query as any;
  const all = await getAll("customers");
  const q = (search as string).toLowerCase();
  const filtered = q
    ? (all as any[]).filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q))
    : (all as any[]);
  filtered.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: filtered.slice((pg - 1) * lim, pg * lim).map(mapCustomer),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

// POST /customers
router.post("/", async (req, res) => {
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  if (!name) { res.status(400).json({ error: "validation", message: "Nome e obrigatorio" }); return; }
  const customer = await createDoc("customers", {
    name, phone: phone ?? null, whatsapp: whatsapp ?? null,
    email: email ?? null, address: address ?? null, notes: notes ?? null,
    total_spent: 0, total_services: 0, last_service_date: null,
    created_at: nowIso(), updated_at: nowIso(),
  });
  res.status(201).json(mapCustomer(customer));
});

// GET /customers/:id
router.get("/:id", async (req, res) => {
  const c = await getById("customers", Number(req.params.id));
  if (!c) { res.status(404).json({ error: "not_found", message: "Cliente nao encontrado" }); return; }
  res.json(mapCustomer(c));
});

// PUT /customers/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = await getById("customers", id) as any;
  if (!c) { res.status(404).json({ error: "not_found", message: "Cliente nao encontrado" }); return; }
  const { name, phone, whatsapp, email, address, notes } = req.body as any;
  await updateDocById("customers", id, {
    name: name ?? c.name, phone: phone ?? c.phone, whatsapp: whatsapp ?? c.whatsapp,
    email: email ?? c.email, address: address ?? c.address, notes: notes ?? c.notes,
    updated_at: nowIso(),
  });
  const updated = await getById("customers", id);
  res.json(mapCustomer(updated));
});

// DELETE /customers/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("customers", id)) {
    res.status(404).json({ error: "not_found", message: "Cliente nao encontrado" }); return;
  }
  const hasApts = await db.collection("appointments").where("customer_id", "==", id).limit(1).get();
  if (!hasApts.empty) {
    res.status(409).json({ error: "conflict", message: "Cliente possui agendamentos e nao pode ser excluido." }); return;
  }
  await deleteDocById("customers", id);
  res.json({ message: "Cliente removido com sucesso" });
});

// GET /customers/:id/vehicles
router.get("/:id/vehicles", async (req, res) => {
  const customerId = Number(req.params.id);
  const snap = await db.collection("vehicles").where("customer_id", "==", customerId).get();
  const vehicles = snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })) as any[];
  const customer = await getById("customers", customerId) as any;
  res.json(vehicles.map((v) => ({
    id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model,
    year: v.year, plate: v.plate, color: v.color, fuel: v.fuel,
    mileage: v.mileage, notes: v.notes, customerName: customer?.name,
  })));
});

// GET /customers/:id/appointments
router.get("/:id/appointments", async (req, res) => {
  const customerId = Number(req.params.id);
  const snap = await db.collection("appointments").where("customer_id", "==", customerId).get();
  const apts = snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })) as any[];
  apts.sort((a, b) => (b.appointment_date ?? "").localeCompare(a.appointment_date ?? ""));
  res.json(apts.map((a) => ({
    id: a.id, customerId: a.customer_id, vehicleId: a.vehicle_id,
    appointmentDate: a.appointment_date, status: a.status,
    finalPrice: Number(a.final_price), createdAt: a.created_at,
  })));
});

// GET /customers/:id/loyalty
router.get("/:id/loyalty", async (req, res) => {
  const customerId = Number(req.params.id);
  const snap = await db.collection("loyalty_cards").where("customer_id", "==", customerId).limit(1).get();
  if (snap.empty) { res.json(null); return; }
  const l = { id: Number(snap.docs[0].id), ...snap.docs[0].data() } as any;
  res.json({
    id: l.id, totalWashes: l.total_washes, currentStampCount: l.current_stamp_count,
    freeWashesEarned: l.free_washes_earned, freeWashesUsed: l.free_washes_used,
    freeWashesPending: l.free_washes_earned - l.free_washes_used,
  });
});

export default router;
