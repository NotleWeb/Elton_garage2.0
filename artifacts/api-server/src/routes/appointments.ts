import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { scheduleAppointmentReminder, scheduleFollowUpReminders } from "../services/notification.service.js";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

// ── constants ────────────────────────────────────────────────────────────────

// Valid status transitions: status can only move forward
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  agendado: ['confirmado', 'cancelado'],
  confirmado: ['em_andamento', 'cancelado'],
  em_andamento: ['concluido', 'cancelado'],
  concluido: [], // No transitions from completed
  cancelado: [],  // No transitions from cancelled
};

const NEXT_STATUS_FOR_STEP: Record<string, string> = {
  agendado: 'confirmado',
  confirmado: 'em_andamento',
  em_andamento: 'concluido',
  concluido: 'concluido',
  cancelado: 'cancelado',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function mapServiceRow(s: any) {
  return {
    id: s.id, name: s.name, price: Number(s.price),
    estimatedDuration: s.estimated_duration, category: s.category,
    description: s.description, vehicleType: s.vehicle_type, active: !!s.active,
  };
}

/**
 * Validates status transition according to workflow rules.
 * Returns error message if invalid, null if valid.
 */
function validateStatusTransition(currentStatus: string, newStatus: string): string | null {
  if (currentStatus === newStatus) return null; // No change is always valid
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    return `Status nao pode mudar de '${currentStatus}' para '${newStatus}'. Transicoes validas: ${allowed.join(', ') || 'nenhuma'}`;
  }
  return null;
}

/**
 * Checks for scheduling conflicts: finds all overlapping appointments on the same day.
 * Returns list of conflicting appointments or empty if none.
 */
async function findScheduleConflicts(
  appointmentDate: string,
  duration: number,
  excludeAppointmentId?: number
): Promise<any[]> {
  // Parse appointment date to day and time
  const startDate = new Date(appointmentDate);
  const dayStart = new Date(startDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Get all appointments on this day
  const allApts = (await getAll("appointments")) as any[];
  const dayApts = allApts.filter((a) => {
    if (excludeAppointmentId && a.id === excludeAppointmentId) return false; // Exclude self
    if (a.status === "cancelado") return false; // Ignore cancelled
    const aptTime = new Date(a.appointment_date);
    return aptTime >= dayStart && aptTime < dayEnd;
  });

  // Calculate end time for this appointment
  const endTime = new Date(startDate);
  endTime.setMinutes(endTime.getMinutes() + duration);

  // Find overlaps
  const conflicts = [];
  for (const existing of dayApts) {
    const existingStart = new Date(existing.appointment_date);
    const existingEnd = new Date(existingStart);
    
    // Get duration of existing appointment
    const existingAptSvcSnap = await db
      .collection("appointment_services")
      .where("appointment_id", "==", existing.id)
      .get();
    const existingSvcIds = existingAptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
    const existingServices = await Promise.all(existingSvcIds.map((sid) => getById("services", sid)));
    const existingDuration = existingServices
      .filter(Boolean)
      .reduce((s, sv: any) => s + (sv?.estimated_duration ?? 0), 0);
    existingEnd.setMinutes(existingEnd.getMinutes() + existingDuration);

    // Check overlap: new appointment overlaps if it starts before existing ends AND ends after existing starts
    if (startDate < existingEnd && endTime > existingStart) {
      conflicts.push(existing);
    }
  }

  return conflicts;
}

/**
 * Rounds time to nearest 30-minute interval (forward).
 * Invalid example: 08:17 → 08:30
 */
function roundTo30Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  if (minutes % 30 !== 0) {
    rounded.setMinutes(Math.ceil(minutes / 30) * 30);
  }
  return rounded;
}

/**
 * Validates time slot is on valid 30-minute boundary.
 */
function isValid30MinInterval(date: Date): boolean {
  return date.getMinutes() % 30 === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
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
    revenueProcessed: !!apt.revenue_processed, // Flag to track if revenue was already recorded
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
  let apts = (await getAll("appointments")) as any[];
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

  // Validate 30-min interval
  const dateObj = new Date(appointmentDate);
  if (!isValid30MinInterval(dateObj)) {
    res.status(400).json({
      error: "validation",
      message: `Horario deve estar em intervalo de 30 minutos. Horario invalido: ${appointmentDate}`,
    });
    return;
  }

  // Calculate total duration
  const ids = Array.isArray(serviceIds) ? serviceIds.map((sid) => Number(sid)) : [];
  let totalDuration = 0;
  if (ids.length) {
    const services = await Promise.all(ids.map((sid) => getById("services", sid)));
    totalDuration = services.filter(Boolean).reduce((sum, svc: any) => sum + (svc?.estimated_duration ?? 0), 0);
  }

  // Check for conflicts
  const conflicts = await findScheduleConflicts(appointmentDate, totalDuration);
  if (conflicts.length > 0) {
    res.status(409).json({
      error: "conflict",
      message: `Horario indisponivel. Conflita com ${conflicts.length} agendamento(s).`,
      conflicts: conflicts.map((c) => ({ id: c.id, appointmentDate: c.appointment_date, status: c.status })),
    });
    return;
  }

  const computedPrice = await calculateAppointmentPrice(serviceIds, discount);
  const apt = (await createDoc("appointments", {
    customer_id: Number(customerId),
    vehicle_id: Number(vehicleId),
    appointment_date: appointmentDate,
    status: "agendado",
    discount: Number(discount ?? 0),
    final_price: finalPrice !== undefined ? Number(finalPrice) : computedPrice,
    observations: observations ?? null,
    revenue_processed: false, // Mark as not yet processed
    created_at: nowIso(),
  })) as any;

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
  scheduleAppointmentReminderForApt(apt.id, customerId, vehicleId, serviceIds ?? [], appointmentDate).catch((err) =>
    logger.error({ err }, "Failed to schedule appointment reminder")
  );

  res.status(201).json(await loadAppointmentDetail(apt));
});

async function scheduleAppointmentReminderForApt(
  appointmentId: number,
  customerId: number,
  vehicleId: number,
  serviceIds: any[],
  appointmentDate: string
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

async function calculateAppointmentPrice(serviceIds: any[] = [], discount?: any) {
  const ids = Array.isArray(serviceIds) ? serviceIds.map((sid) => Number(sid)) : [];
  if (!ids.length) return 0;
  const services = await Promise.all(ids.map((sid) => getById("services", sid)));
  const total = services.filter(Boolean).reduce((sum, svc: any) => sum + Number(svc.price ?? 0), 0);
  const discountValue = Number(discount ?? 0);
  return Math.max(0, total - discountValue);
}

/**
 * Processes appointment completion: records revenue, updates loyalty, sends notification.
 * Only processes ONCE using revenue_processed flag to prevent duplicates.
 */
async function handleAppointmentCompletion(id: number, paymentMethod?: string | null) {
  const updated = (await getById("appointments", id)) as any;
  if (!updated) return;

  // CRITICAL: Check if already processed to prevent duplicate revenue
  if (updated.revenue_processed) {
    logger.info({ appointmentId: id }, "Appointment already processed, skipping revenue calculation");
    return;
  }

  const aptSvcSnap = await db.collection("appointment_services").where("appointment_id", "==", id).get();
  const svcIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
  const computedPrice = await calculateAppointmentPrice(svcIds, updated.discount);
  const price = Number(updated.final_price ?? 0) || computedPrice;
  const dateStr = new Date().toISOString().split("T")[0];

  const [customer, services] = await Promise.all([
    getById("customers", updated.customer_id),
    Promise.all(svcIds.map((sid) => getById("services", sid))),
  ]) as [any, any[]];
  const validSvcs = services.filter(Boolean) as any[];
  const svcNames = validSvcs.map((s) => s.name).join(", ");
  const custName = customer?.name ?? "";

  await db.runTransaction(async (t) => {
    // Record financial transaction
    const txRef = db.collection("financial_transactions").doc();
    t.set(txRef, {
      type: "receita",
      category: "Servicos",
      description: `${svcNames} - ${custName}`,
      amount: price,
      date: dateStr,
      appointment_id: id,
      payment_method: paymentMethod ?? null,
      created_at: nowIso(),
    });

    // Update customer stats
    if (customer) {
      const custRef = db.collection("customers").doc(String(customer.id));
      t.update(custRef, {
        total_spent: Number(customer.total_spent ?? 0) + price,
        total_services: Number(customer.total_services ?? 0) + 1,
        last_service_date: dateStr,
        updated_at: nowIso(),
      });
    }

    // Mark appointment as revenue-processed to prevent future duplicates
    const aptRef = db.collection("appointments").doc(String(id));
    t.update(aptRef, { revenue_processed: true, updated_at: nowIso() });
  });

  // Update loyalty (if wash service)
  const isWash = validSvcs.some((s: any) => s?.category === "Lavagem");
  if (isWash && customer) {
    const lSnap = await db.collection("loyalty_cards").where("customer_id", "==", updated.customer_id).limit(1).get();
    if (lSnap.empty) {
      await createDoc("loyalty_cards", {
        customer_id: updated.customer_id,
        total_washes: 1,
        current_stamp_count: 1,
        free_washes_earned: 0,
        free_washes_used: 0,
        updated_at: nowIso(),
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

  const apt = (await getById("appointments", id)) as any;
  if (!apt) {
    res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" });
    return;
  }

  // Validate status transition
  const transitionError = validateStatusTransition(apt.status, status);
  if (transitionError) {
    res.status(400).json({ error: "invalid_transition", message: transitionError });
    return;
  }

  const prevStatus = apt.status;
  await updateDocById("appointments", id, { status, updated_at: nowIso() });

  // Only process revenue on first completion
  if (status === "concluido" && prevStatus !== "concluido") {
    await handleAppointmentCompletion(id, null);
  }

  res.json(await loadAppointmentDetail(await getById("appointments", id)));
});

// ── PUT /appointments/:id ─────────────────────────────────────────────────────

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const apt = (await getById("appointments", id)) as any;
  if (!apt) {
    res.status(404).json({ error: "not_found", message: "Agendamento nao encontrado" });
    return;
  }

  const { status, serviceIds, appointmentDate, discount, finalPrice, observations, paymentMethod } = req.body as any;
  const prevStatus = apt.status;
  const newStatus = status ?? prevStatus;

  // Validate status transition
  if (newStatus !== prevStatus) {
    const transitionError = validateStatusTransition(prevStatus, newStatus);
    if (transitionError) {
      res.status(400).json({ error: "invalid_transition", message: transitionError });
      return;
    }
  }

  // If changing appointment date/time, validate 30-min interval and check conflicts
  if (appointmentDate && appointmentDate !== apt.appointment_date) {
    const dateObj = new Date(appointmentDate);
    if (!isValid30MinInterval(dateObj)) {
      res.status(400).json({
        error: "validation",
        message: `Horario deve estar em intervalo de 30 minutos. Horario invalido: ${appointmentDate}`,
      });
      return;
    }

    // Recalculate duration with new or existing services
    const ids = Array.isArray(serviceIds) ? serviceIds : apt.serviceIds;
    let totalDuration = 0;
    if (Array.isArray(ids) && ids.length) {
      const services = await Promise.all(ids.map((sid) => getById("services", Number(sid))));
      totalDuration = services.filter(Boolean).reduce((sum, svc: any) => sum + (svc?.estimated_duration ?? 0), 0);
    }

    // Check conflicts (excluding this appointment)
    const conflicts = await findScheduleConflicts(appointmentDate, totalDuration, id);
    if (conflicts.length > 0) {
      res.status(409).json({
        error: "conflict",
        message: `Horario indisponivel. Conflita com ${conflicts.length} agendamento(s).`,
        conflicts: conflicts.map((c) => ({ id: c.id, appointmentDate: c.appointment_date, status: c.status })),
      });
      return;
    }
  }

  const updatedDiscount = discount !== undefined ? Number(discount) : apt.discount;
  const updatedServiceIds = Array.isArray(serviceIds) ? serviceIds : undefined;
  const computedPrice = updatedServiceIds ? await calculateAppointmentPrice(updatedServiceIds, updatedDiscount) : undefined;
  const newFinalPrice = finalPrice !== undefined ? Number(finalPrice) : computedPrice !== undefined ? computedPrice : Number(apt.final_price ?? 0);

  await updateDocById("appointments", id, {
    status: newStatus,
    appointment_date: appointmentDate ?? apt.appointment_date,
    discount: updatedDiscount,
    final_price: newFinalPrice,
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

  // Process revenue only on first completion
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
