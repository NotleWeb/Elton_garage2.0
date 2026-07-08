import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(authMiddleware);

function mapOS(os: any) {
  return {
    id: os.id, appointmentId: os.appointment_id,
    beforePhotos: JSON.parse(os.before_photos || "[]"),
    afterPhotos: JSON.parse(os.after_photos || "[]"),
    checklist: JSON.parse(os.checklist || "{}"),
    observations: os.observations, paymentMethod: os.payment_method,
    technician: os.technician, signature: os.signature,
  };
}

export function registerOrderServiceRoutes(parentRouter: Router) {
  parentRouter.get("/:id/order-service", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const os = db.prepare("SELECT * FROM order_services WHERE appointment_id = ?").get(id) as any;
    if (!os) { res.status(404).json({ error: "not_found", message: "Ordem de serviço não encontrada" }); return; }
    res.json(mapOS(os));
  });

  parentRouter.post("/:id/order-service", authMiddleware, (req, res) => {
    const appointmentId = Number(req.params.id);
    const { beforePhotos, afterPhotos, checklist, observations, paymentMethod, technician, signature } = req.body as any;
    const existing = db.prepare("SELECT id FROM order_services WHERE appointment_id = ?").get(appointmentId);
    if (existing) { res.status(400).json({ error: "conflict", message: "Ordem de serviço já existe para este agendamento" }); return; }
    const result = db.prepare("INSERT INTO order_services (appointment_id, before_photos, after_photos, checklist, observations, payment_method, technician, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(appointmentId, JSON.stringify(beforePhotos ?? []), JSON.stringify(afterPhotos ?? []), JSON.stringify(checklist ?? {}), observations ?? null, paymentMethod ?? null, technician ?? null, signature ?? null);
    const os = db.prepare("SELECT * FROM order_services WHERE id = ?").get(result.lastInsertRowid) as any;
    res.status(201).json(mapOS(os));
  });

  parentRouter.put("/:id/order-service", authMiddleware, (req, res) => {
    const appointmentId = Number(req.params.id);
    const os = db.prepare("SELECT * FROM order_services WHERE appointment_id = ?").get(appointmentId) as any;
    if (!os) { res.status(404).json({ error: "not_found", message: "Ordem de serviço não encontrada" }); return; }
    const { beforePhotos, afterPhotos, checklist, observations, paymentMethod, technician, signature } = req.body as any;
    db.prepare("UPDATE order_services SET before_photos=?, after_photos=?, checklist=?, observations=?, payment_method=?, technician=?, signature=? WHERE appointment_id=?").run(JSON.stringify(beforePhotos ?? JSON.parse(os.before_photos)), JSON.stringify(afterPhotos ?? JSON.parse(os.after_photos)), JSON.stringify(checklist ?? JSON.parse(os.checklist)), observations ?? os.observations, paymentMethod ?? os.payment_method, technician ?? os.technician, signature ?? os.signature, appointmentId);
    const updated = db.prepare("SELECT * FROM order_services WHERE appointment_id = ?").get(appointmentId) as any;
    res.json(mapOS(updated));
  });
}

export default router;
