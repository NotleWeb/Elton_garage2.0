import { Router } from "express";
import { db, getById, createDoc, updateDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

function mapOs(os: any) {
  return {
    id: os.id, appointmentId: os.appointment_id,
    beforePhotos: os.before_photos ?? [],
    afterPhotos: os.after_photos ?? [],
    checklist: os.checklist ?? {},
    observations: os.observations ?? null,
    paymentMethod: os.payment_method ?? null,
    technician: os.technician ?? null,
    signature: os.signature ?? null,
    createdAt: os.created_at, updatedAt: os.updated_at,
  };
}

// GET /appointments/:appointmentId/order-service
router.get("/", async (req, res) => {
  const aptId = Number((req.params as any).appointmentId);
  const snap = await db.collection("order_services").where("appointment_id", "==", aptId).limit(1).get();
  if (snap.empty) { res.json(null); return; }
  const os = { id: Number(snap.docs[0].id), ...snap.docs[0].data() };
  res.json(mapOs(os));
});

// POST /appointments/:appointmentId/order-service
router.post("/", async (req, res) => {
  const aptId = Number((req.params as any).appointmentId);
  if (!await getById("appointments", aptId)) {
    res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return;
  }
  const existing = await db.collection("order_services").where("appointment_id", "==", aptId).limit(1).get();
  if (!existing.empty) {
    res.status(409).json({ error: "conflict", message: "Ordem de servico ja existe para este agendamento" }); return;
  }
  const { beforePhotos, afterPhotos, checklist, observations, paymentMethod, technician, signature } = req.body as any;
  const os = await createDoc("order_services", {
    appointment_id: aptId,
    before_photos: beforePhotos ?? [], after_photos: afterPhotos ?? [],
    checklist: checklist ?? {}, observations: observations ?? null,
    payment_method: paymentMethod ?? null, technician: technician ?? null,
    signature: signature ?? null, created_at: nowIso(), updated_at: nowIso(),
  });
  res.status(201).json(mapOs(os));
});

// PUT /appointments/:appointmentId/order-service
router.put("/", async (req, res) => {
  const aptId = Number((req.params as any).appointmentId);
  const snap = await db.collection("order_services").where("appointment_id", "==", aptId).limit(1).get();
  if (snap.empty) { res.status(404).json({ error: "not_found", message: "Ordem de servico nao encontrada" }); return; }
  const osId = Number(snap.docs[0].id);
  const cur = { id: osId, ...snap.docs[0].data() } as any;
  const { beforePhotos, afterPhotos, checklist, observations, paymentMethod, technician, signature } = req.body as any;
  await updateDocById("order_services", osId, {
    before_photos: beforePhotos ?? cur.before_photos,
    after_photos: afterPhotos ?? cur.after_photos,
    checklist: checklist ?? cur.checklist,
    observations: observations ?? cur.observations,
    payment_method: paymentMethod ?? cur.payment_method,
    technician: technician ?? cur.technician,
    signature: signature ?? cur.signature,
    updated_at: nowIso(),
  });
  const updated = await getById("order_services", osId);
  res.json(mapOs(updated));
});

export default router;
