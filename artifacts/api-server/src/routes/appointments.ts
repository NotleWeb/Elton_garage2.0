import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { scheduleAppointmentReminder, scheduleFollowUpReminders } from "../services/notification.service.js";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

// ── helpers ──────────────────────────────────────────────────────────────────

function mapServiceRow(s: any) {
  return {
    id: s.id, name: s.name, price: Number(s.price),
    estimatedDuration: s.estimated_duration, category: s.category,
    description: s.description, vehicleType: s.vehicle_type, active: !!s.active,
  };
}

async function loadAppointmentDetail(apt: any) {
  const [customer, vehicle, aptSvcSnap] = await Promise.all([
    getById("customers", apt.customer_id),
    getById("vehicles", apt.vehicle_id),
    db.collection("appointment_services").where("appointment_id", "==", apt.id).get(),
  ]);
  const serviceIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
  const services = await Promise.all(serviceIds.map((sid) => getById("services", sid)));
  const validServices = services.filter(Boolean) as any[];
  const totalDuration = validServices.reduce((s, sv) => s + (sv?.estimated_duration ?? 0), 0);

  const osSnap = await db.collection("order_services").where("appointment_id", "==", apt.id).limit(1).get();
  let orderService: any;
  if (!osSnap.empty) {
    const os = { id: Number(osSnap.docs[0].id), ...osSnap.docs[0].data() } as any;
    orderService = {
      id: os.id, appointmentId: os.appointment_id,
      beforePhotos: os.before_photos ?? [], afterPhotos: os.after_photos ?? [],
      checklist: os.checklist ?? {}, observations: os.observations,
      paymentMethod: os.payment_method, technician: os.technician, signature: os.signature,
    };
  }

  const c = customer as any;
  const v = vehicle as any;
  return {
    id: apt.id, customerId: apt.customer_id, vehicleId: apt.vehicle_id,
    serviceIds, appointmentDate: apt.appointment_date, status: apt.status,
    discount: Number(apt.discount ?? 0), finalPrice: Number(apt.final_price),
    totalDuration, observations: apt.observations, createdAt: apt.created_at,
    customer: c ? {
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      totalSpent: Number(c.total_spent), totalServices: c.total_services,
      createdAt: c.created_at, updatedAt: c.updated_at,
    } : undefined,
    vehicle: v ? {
      id: v.id, customerId: v.customer_id, brand: v.brand, model: v.model,
      plate: v.plate, color: v.color, fuel: v.fuel, year: v.year,
    } : undefined,
    services: validServices.map(mapServiceRow),
    orderService,
  };
}

// ── GET /appointments ─────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", status, customerId, vehicleId, startDate, endDate } = req.query as any;
  let apts = await getAll("appointments") as any[];
  if (status) apts = apts.filter((a) => a.status === status);
  if (customerId) apts = apts.filter((a) => a.customer_id === Number(customerId));
  if (vehicleId) apts = apts.filter((a) => a.vehicle_id === Number(vehicleId));
  if (startDate) apts = apts.filter((a) => (a.appointment_date ?? "") >= startDate);
  if (endDate) apts = apts.filter((a) => (a.appointment_date ?? "") <= endDate + "T23:59:59");
  apts.sort((a, b) => (b.appointment_date ?? "").localeCompare(a.appointment_date ?? ""));
  const total = apts.length;
  const pg = Number(page);
  const lim = Number(limit);
  const page_data = apts.slice((pg - 1) * lim, pg * lim);
  const data = await Promise.all(page_data.map(loadAppointmentDetail));
  res.json({ data, meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) } });
});

// ── GET /appointments/:id ─────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const apt = await getById("appointments", Number(req.params.id));
  if (!apt) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }
  res.json(await loadAppointmentDetail(apt));
});

// ── POST /appointments ────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { customerId, vehicleId, serviceIds, appointmentDate, discount, finalPrice, observations } = req.body as any;
  if (!customerId || !vehicleId || !appointmentDate) {
    res.status(400).json({ error: "validation", message: "Cliente, veiculo e data sao obrigatorios" });
    return;
  }
  const apt = await createDoc("appointments", {
    customer_id: Number(customerId), vehicle_id: Number(vehicleId),
    appointment_date: appointmentDate, status: "agendado",
    discount: Number(discount ?? 0), final_price: Number(finalPrice ?? 0),
    observations: observations ?? null, created_at: nowIso(),
  }) as any;

  // Batch-write service associations
  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    const batch = db.batch();
    for (const sid of serviceIds) {
      const ref = db.collection("appointment_services").doc();
      batch.set(ref, { appointment_id: apt.id, service_id: Number(sid) });
    }
    await batch.commit();
  }

  // Schedule appointment reminder (1 hour before) — non-blocking
  scheduleAppointmentReminderForApt(apt.id, customerId, vehicleId, serviceIds ?? [], appointmentDate)
    .catch((err) => logger.error({ err }, "Failed to schedule appointment reminder"));

  res.status(201).json(await loadAppointmentDetail(apt));
});

async function scheduleAppointmentReminderForApt(
  appointmentId: number,
  customerId: number,
  vehicleId: number,
  serviceIds: any[],
  appointmentDate: string,
): Promise<void> {
  const [customer, vehicle, services] = await Promise.all([
    getById("customers", Number(customerId)),
    getById("vehicles", Number(vehicleId)),
    Promise.all(serviceIds.map((sid) => getById("services", Number(sid)))),
  ]) as [any, any, any[]];

  const validServices = services.filter(Boolean) as any[];
  const vehicleInfo = vehicle ? `${vehicle.brand} ${vehicle.model}` : "";
  const plate = vehicle?.plate ?? "";

  await scheduleAppointmentReminder({
    appointmentId,
    appointmentDate,
    customerId: Number(customerId),
    customerName: customer?.name ?? "",
    vehicleInfo,
    plate,
    serviceNames: validServices.map((s) => s.name),
  });
}

// ── HELPERS ─────────────────────────────────────────────────────────────────

async function handleAppointmentCompletion(id: number, paymentMethod?: string | null) {
  const updated = await getById("appointments", id) as any;
  if (!updated) return;

  const price = Number(updated.final_price ?? 0);
  const dateStr = new Date().toISOString().split("T")[0];

  const aptSvcSnap = await db.collection("appointment_services").where("appointment_id", "==", id).get();
  const svcIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
  const [customer, services] = await Promise.all([
    getById("customers", updated.customer_id),
    Promise.all(svcIds.map((sid) => getById("services", sid))),
  ]) as [any, any[]];
  const validSvcs = services.filter(Boolean) as any[];
  const svcNames = validSvcs.map((s) => s.name).join(", ");
  const custName = customer?.name ?? "";

  await db.runTransaction(async (t) => {
    const txRef = db.collection("financial_transactions").doc();
    t.set(txRef, {
      type: "receita", category: "Servicos",
      description: `${svcNames} - ${custName}`,
      amount: price, date: dateStr, appointment_id: id,
      payment_method: paymentMethod ?? null, created_at: nowIso(),
    });

    if (customer) {
      const custRef = db.collection("customers").doc(String(customer.id));
      t.update(custRef, {
        total_spent: Number(customer.total_spent ?? 0) + price,
        total_services: Number(customer.total_services ?? 0) + 1,
        last_service_date: dateStr, updated_at: nowIso(),
      });
    }
  });

  const isWash = validSvcs.some((s: any) => s?.category === "Lavagem");
  if (isWash && customer) {
    const lSnap = await db.collection("loyalty_cards").where("customer_id", "==", updated.customer_id).limit(1).get();
    if (lSnap.empty) {
      await createDoc("loyalty_cards", {
        customer_id: updated.customer_id, total_washes: 1, current_stamp_count: 1,
        free_washes_earned: 0, free_washes_used: 0, updated_at: nowIso(),
      });
    } else {
      const l = { id: Number(lSnap.docs[0].id), ...lSnap.docs[0].data() } as any;
      const newTotal = l.total_washes + 1;
      const newStamp = (l.current_stamp_count + 1) % 10;
      const newEarned = Math.floor(newTotal / 10);
      await updateDocById("loyalty_cards", l.id, {
        total_washes: newTotal,
        current_stamp_count: newStamp,
        free_washes_earned: Math.max(newEarned, l.free_washes_earned),
        updated_at: nowIso(),
      });
    }
  }

  await createDoc("notifications", {
    customer_id: updated.customer_id,
    appointment_id: id,
    title: "Servico Concluido",
    message: `Servico de ${custName} (${svcNames}) concluido com sucesso.`,
    type: "service_completed",
    subtype: null,
    scheduled_for: null,
    read: 0,
    read_at: null,
    completed: 0,
    completed_at: null,
    archived: 0,
    created_at: nowIso(),
  });

  scheduleFollowUpReminders({
    appointmentId: id,
    customerId: updated.customer_id,
    customerName: custName,
    completionDate: nowIso(),
  }).catch((err) => logger.error({ err }, "Failed to schedule follow-up reminders"));
}

// ── PATCH /appointments/:id/status ─────────────────────────────────────────────

router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as any;
  if (!status) {
    res.status(400).json({ error: "validation", message: "Status e obrigatorio" });
    return;
  }

  const apt = await getById("appointments", id) as any;
  if (!apt) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }

  const prevStatus = apt.status;
  await updateDocById("appointments", id, { status, updated_at: nowIso() });

  if (status === "concluido" && prevStatus !== "concluido") {
    await handleAppointmentCompletion(id, null);
  }

  res.json(await loadAppointmentDetail(await getById("appointments", id)));
});

// ── PUT /appointments/:id ─────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const apt = await getById("appointments", id) as any;
  if (!apt) { res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" }); return; }

  const { status, serviceIds, appointmentDate, discount, finalPrice, observations, paymentMethod } = req.body as any;
  const prevStatus = apt.status;
  const newStatus = status ?? prevStatus;

  await updateDocById("appointments", id, {
    status: newStatus,
    appointment_date: appointmentDate ?? apt.appointment_date,
    discount: discount !== undefined ? Number(discount) : apt.discount,
    final_price: finalPrice !== undefined ? Number(finalPrice) : apt.final_price,
    observations: observations ?? apt.observations,
    updated_at: nowIso(),
  });

  // Update service IDs atomically if provided
  if (Array.isArray(serviceIds)) {
    const existing = await db.collection("appointment_services").where("appointment_id", "==", id).get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    for (const sid of serviceIds) {
      const ref = db.collection("appointment_services").doc();
      batch.set(ref, { appointment_id: id, service_id: Number(sid) });
    }
    await batch.commit();
  }

  if (newStatus === "concluido" && prevStatus !== "concluido") {
    await handleAppointmentCompletion(id, paymentMethod ?? null);
  }

  res.json(await loadAppointmentDetail(await getById("appointments", id)));
});

// ── DELETE /appointments/:id ──────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("appointments", id)) {
    res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" });
    return;
  }

  const [aptSvcs, orderSvcs, productUsages] = await Promise.all([
    db.collection("appointment_services").where("appointment_id", "==", id).get(),
    db.collection("order_services").where("appointment_id", "==", id).get(),
    db.collection("product_usage").where("appointment_id", "==", id).get(),
  ]);

  for (const doc of productUsages.docs) {
    const u = doc.data() as any;
    const product = await getById("products", u.product_id) as any;
    if (product) {
      await updateDocById("products", u.product_id, { stock: Number(product.stock) + Number(u.quantity) });
    }
  }

  const batch = db.batch();
  aptSvcs.docs.forEach((d) => batch.delete(d.ref));
  orderSvcs.docs.forEach((d) => batch.delete(d.ref));
  productUsages.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection("appointments").doc(String(id)));
  await batch.commit();

  res.json({ message: "Agendamento removido com sucesso" });
});

export default router;
