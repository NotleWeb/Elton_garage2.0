import { Router } from "express";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById, nowIso, nextId } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { scheduleAppointmentReminder, scheduleFollowUpReminders } from "../services/notification.service.js";
import { getBusinessDate } from "../services/appointment-revenue.js";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(authMiddleware);

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate time is in 30-minute intervals (HH:00 or HH:30)
 */
function validateTime(datetime: string): { valid: boolean; error?: string } {
  try {
    const d = new Date(datetime);
    if (Number.isNaN(d.getTime())) {
      return { valid: false, error: "Data/hora invalida" };
    }
    const mins = d.getMinutes();
    if (mins !== 0 && mins !== 30) {
      return { valid: false, error: "Agendamentos devem ser em intervalos de 30 minutos (HH:00 ou HH:30)" };
    }
    if (d.getSeconds() !== 0) {
      return { valid: false, error: "Agendamentos nao devem conter segundos" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Data/hora invalida" };
  }
}

/**
 * Validate status workflow: agendado → confirmado → em_andamento → concluido
 */
function validateStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  const WORKFLOW = ["agendado", "confirmado", "em_andamento", "concluido"];
  const currentIdx = WORKFLOW.indexOf(currentStatus);
  const newIdx = WORKFLOW.indexOf(newStatus);

  // Cancelado can be reached from any state
  if (newStatus === "cancelado") return { valid: true };

  // Invalid status
  if (currentIdx === -1 || newIdx === -1) {
    return { valid: false, error: `Status invalido: ${newStatus}` };
  }

  // Can only move forward (or stay same)
  if (newIdx < currentIdx) {
    return { valid: false, error: `Nao e permitido mudar de ${currentStatus} para ${newStatus}. Status deve progredir: agendado → confirmado → em_andamento → concluido` };
  }

  return { valid: true };
}

/**
 * Check for overlapping appointments on the same day
 */
async function checkScheduleConflict(
  appointmentDate: string,
  serviceIds: number[],
  excludeAppointmentId?: number
): Promise<{ conflict: boolean; error?: string }> {
  try {
    const requestedServiceIds = Array.isArray(serviceIds)
      ? serviceIds.map((sid) => Number(sid)).filter((sid) => Number.isFinite(sid))
      : [];
    const dateStr = appointmentDate.split("T")[0];
    const allApts = (await getAll("appointments")) as any[];
    const aptServiceLinks = (await getAll("appointment_services")) as any[];
    const serviceIdsByAppointment = new Map<number, number[]>();

    for (const link of aptServiceLinks) {
      const aptId = Number((link as any).appointment_id);
      const serviceId = Number((link as any).service_id);
      if (!Number.isFinite(aptId) || !Number.isFinite(serviceId)) continue;
      const current = serviceIdsByAppointment.get(aptId) ?? [];
      current.push(serviceId);
      serviceIdsByAppointment.set(aptId, current);
    }

    const durationByServiceId = new Map<number, number>();
    const getTotalDuration = async (ids: number[]): Promise<number> => {
      let total = 0;
      for (const sid of ids) {
        if (!durationByServiceId.has(sid)) {
          const service = await getById("services", sid) as any;
          durationByServiceId.set(sid, Number(service?.estimated_duration ?? 0));
        }
        total += Number(durationByServiceId.get(sid) ?? 0);
      }
      return total;
    };
    
    // Get requested appointment time and duration
    const reqTime = new Date(appointmentDate);
    const reqDuration = await getTotalDuration(requestedServiceIds);
    const reqEnd = new Date(reqTime.getTime() + reqDuration * 60000);

    // Check against existing appointments on same date
    for (const apt of allApts) {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;
      if (apt.status === "cancelado") continue;

      const aptDateStr = apt.appointment_date.split("T")[0];
      if (aptDateStr !== dateStr) continue;

      const aptTime = new Date(apt.appointment_date);
      const aptServiceIds = serviceIdsByAppointment.get(Number(apt.id)) ?? [];
      const aptDuration = await getTotalDuration(aptServiceIds);
      const aptEnd = new Date(aptTime.getTime() + aptDuration * 60000);

      // Check for overlap
      if (reqTime < aptEnd && reqEnd > aptTime) {
        const timeStr = reqTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return { conflict: true, error: `Conflito: ja existe agendamento no horario ${timeStr}` };
      }
    }

    return { conflict: false };
  } catch (e) {
    logger.error({ err: e }, "Error checking schedule conflict");
    return { conflict: false };
  }
}

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
  const {
    page = "1",
    limit = "20",
    status,
    customerId,
    vehicleId,
    startDate,
    endDate,
    dateFrom,
    dateTo,
    month,
    year,
  } = req.query as any;
  let apts = await getAll("appointments") as any[];
  const start = dateFrom ?? startDate;
  const end = dateTo ?? endDate;
  const monthNum = Number(month);
  const yearNum = Number(year);

  if (status) apts = apts.filter((a) => a.status === status);
  if (customerId) apts = apts.filter((a) => a.customer_id === Number(customerId));
  if (vehicleId) apts = apts.filter((a) => a.vehicle_id === Number(vehicleId));

  if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12 && Number.isFinite(yearNum) && yearNum > 0) {
    const ym = `${String(yearNum).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}`;
    apts = apts.filter((a) => (a.appointment_date ?? "").startsWith(ym));
  } else {
    if (start) apts = apts.filter((a) => (a.appointment_date ?? "") >= start);
    if (end) apts = apts.filter((a) => (a.appointment_date ?? "") <= end + "T23:59:59");
  }

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

  const normalizedServiceIds = Array.isArray(serviceIds)
    ? serviceIds.map((sid: any) => Number(sid)).filter((sid: number) => Number.isFinite(sid))
    : [];

  if (normalizedServiceIds.length === 0) {
    res.status(400).json({ error: "validation", message: "Selecione ao menos 1 servico" });
    return;
  }

  const [customer, vehicle] = await Promise.all([
    getById("customers", Number(customerId)),
    getById("vehicles", Number(vehicleId)),
  ]) as [any, any];

  if (!customer) {
    res.status(400).json({ error: "validation", message: "Cliente nao encontrado" });
    return;
  }

  if (!vehicle) {
    res.status(400).json({ error: "validation", message: "Veiculo nao encontrado" });
    return;
  }

  if (Number(vehicle.customer_id) !== Number(customerId)) {
    res.status(400).json({ error: "validation", message: "Veiculo nao pertence ao cliente selecionado" });
    return;
  }

  const requestedServices = await Promise.all(
    normalizedServiceIds.map((sid: number) => getById("services", sid))
  );

  if (requestedServices.some((s) => !s)) {
    res.status(400).json({ error: "validation", message: "Um ou mais servicos selecionados nao existem" });
    return;
  }

  // Validate time format (30-minute intervals)
  const timeCheck = validateTime(appointmentDate);
  if (!timeCheck.valid) {
    res.status(400).json({ error: "validation", message: timeCheck.error });
    return;
  }

  // Check for scheduling conflicts
  const conflictCheck = await checkScheduleConflict(appointmentDate, normalizedServiceIds);
  if (conflictCheck.conflict) {
    res.status(409).json({ error: "schedule_conflict", message: conflictCheck.error });
    return;
  }

  const computedPrice = await calculateAppointmentPrice(normalizedServiceIds, discount);
  const apt = await createDoc("appointments", {
    customer_id: Number(customerId), vehicle_id: Number(vehicleId),
    appointment_date: appointmentDate, status: "agendado",
    discount: Number(discount ?? 0),
    final_price: finalPrice !== undefined ? Number(finalPrice) : computedPrice,
    observations: observations ?? null, created_at: nowIso(),
    revenue_processed: false,
  }) as any;

  // Batch-write service associations
  if (normalizedServiceIds.length > 0) {
    const batch = db.batch();
    for (const sid of normalizedServiceIds) {
      const ref = db.collection("appointment_services").doc();
      batch.set(ref, { appointment_id: apt.id, service_id: Number(sid) });
    }
    await batch.commit();
  }

  // Schedule appointment reminder (1 hour before) — non-blocking
  scheduleAppointmentReminderForApt(apt.id, customerId, vehicleId, normalizedServiceIds, appointmentDate)
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

async function calculateAppointmentPrice(serviceIds: any[] = [], discount?: any) {
  const ids = Array.isArray(serviceIds) ? serviceIds.map((sid) => Number(sid)) : [];
  if (!ids.length) return 0;
  const services = await Promise.all(ids.map((sid) => getById("services", sid)));
  const total = services.filter(Boolean).reduce((sum, svc: any) => sum + Number(svc.price ?? 0), 0);
  const discountValue = Number(discount ?? 0);
  return Math.max(0, total - discountValue);
}

async function claimRevenueProcessing(appointmentId: number): Promise<boolean> {
  const aptRef = db.collection("appointments").doc(String(appointmentId));

  return db.runTransaction(async (t) => {
    const snap = await t.get(aptRef);
    if (!snap.exists) return false;
    const data = snap.data() as any;
    if (data?.revenue_processed) return false;

    t.update(aptRef, {
      revenue_processed: true,
      updated_at: nowIso(),
    });
    return true;
  });
}

async function handleAppointmentCompletion(id: number, paymentMethod?: string | null) {
  const updated = await getById("appointments", id) as any;
  if (!updated) return;

  await ensureLoyaltyWash(id, updated);

  // Idempotency guard for legacy/race scenarios: if a revenue tx for this
  // appointment already exists, skip side effects.
  const existingRevenue = await db
    .collection("financial_transactions")
    .where("appointment_id", "==", id)
    .where("type", "==", "receita")
    .limit(1)
    .get();
  if (!existingRevenue.empty) return;

  const aptSvcSnap = await db.collection("appointment_services").where("appointment_id", "==", id).get();
  const svcIds = aptSvcSnap.docs.map((d) => (d.data() as any).service_id as number);
  const computedPrice = await calculateAppointmentPrice(svcIds, updated.discount);
  const price = Number(updated.final_price ?? 0) || computedPrice;
  const dateStr = getBusinessDate(nowIso());

  const [customer, services] = await Promise.all([
    getById("customers", updated.customer_id),
    Promise.all(svcIds.map((sid) => getById("services", sid))),
  ]) as [any, any[]];
  const validSvcs = services.filter(Boolean) as any[];
  const svcNames = validSvcs.map((s) => s.name).join(", ");
  const custName = customer?.name ?? "";

  // Use integer ID (nextId) so the financial transaction is deletable/editable later
  const txId = await nextId("financial_transactions");
  const txData = {
    type: "receita", category: "Servicos",
    description: `${svcNames} - ${custName}`,
    amount: price, date: dateStr, appointment_id: id,
    payment_method: paymentMethod ?? null, created_at: nowIso(),
  };

  await db.runTransaction(async (t) => {
    const txRef = db.collection("financial_transactions").doc(String(txId));
    t.set(txRef, txData);

    if (customer) {
      const custRef = db.collection("customers").doc(String(customer.id));
      t.update(custRef, {
        total_spent: Number(customer.total_spent ?? 0) + price,
        total_services: Number(customer.total_services ?? 0) + 1,
        last_service_date: dateStr, updated_at: nowIso(),
      });
    }
  });

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

async function ensureLoyaltyWash(id: number, appointment: any): Promise<void> {
  const isAlreadyProcessed = await db.runTransaction(async (transaction) => {
    const appointmentRef = db.collection("appointments").doc(String(id));
    const snapshot = await transaction.get(appointmentRef);
    if ((snapshot.data() as any)?.loyalty_wash_processed) return true;
    transaction.update(appointmentRef, { loyalty_wash_processed: true, updated_at: nowIso() });
    return false;
  });
  if (isAlreadyProcessed) return;

  const serviceLinks = await db.collection("appointment_services").where("appointment_id", "==", id).get();
  const services = await Promise.all(serviceLinks.docs.map((doc) => getById("services", Number((doc.data() as any).service_id))));
  if (!(services as any[]).some((service) => String(service?.category ?? "").toLowerCase().includes("lavagem"))) return;

  const loyaltySnapshot = await db.collection("loyalty_cards").where("customer_id", "==", appointment.customer_id).limit(1).get();
  if (loyaltySnapshot.empty) {
    await createDoc("loyalty_cards", {
      customer_id: appointment.customer_id, total_washes: 1, current_stamp_count: 1,
      free_washes_earned: 0, free_washes_used: 0, updated_at: nowIso(),
    });
    return;
  }
  const card = loyaltySnapshot.docs[0];
  const data = card.data() as any;
  const totalWashes = Number(data.total_washes ?? 0) + 1;
  await card.ref.update({
    total_washes: totalWashes,
    current_stamp_count: totalWashes % 10,
    free_washes_earned: Math.max(Math.floor(totalWashes / 10), Number(data.free_washes_used ?? 0)),
    updated_at: nowIso(),
  });
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

  // Validate status transition
  const transCheck = validateStatusTransition(apt.status, status);
  if (!transCheck.valid) {
    res.status(400).json({ error: "invalid_status_transition", message: transCheck.error });
    return;
  }

  const prevStatus = apt.status;
  await updateDocById("appointments", id, { status, updated_at: nowIso() });

  // Process completion side effects only once with transactional claim.
  if (status === "concluido") {
    const claimed = await claimRevenueProcessing(id);
    if (claimed) {
      try {
        await handleAppointmentCompletion(id, null);
      } catch (err) {
        await updateDocById("appointments", id, { revenue_processed: false, updated_at: nowIso() });
        logger.error({ err, appointmentId: id }, "Failed to process appointment completion");
        res.status(500).json({ error: "internal_error", message: "Falha ao concluir servico" });
        return;
      }
    }
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
  const updatedServiceIds = Array.isArray(serviceIds) ? serviceIds : ((apt as any).serviceIds ?? []);
  const updatedAppointmentDate = appointmentDate ?? apt.appointment_date;

  // Validate status transition if changing
  if (status && status !== prevStatus) {
    const transCheck = validateStatusTransition(prevStatus, status);
    if (!transCheck.valid) {
      res.status(400).json({ error: "invalid_status_transition", message: transCheck.error });
      return;
    }
  }

  // Validate time format if changing date
  if (appointmentDate) {
    const timeCheck = validateTime(appointmentDate);
    if (!timeCheck.valid) {
      res.status(400).json({ error: "validation", message: timeCheck.error });
      return;
    }

    // Check for conflicts if changing date or services
    const conflictCheck = await checkScheduleConflict(appointmentDate, updatedServiceIds, id);
    if (conflictCheck.conflict) {
      res.status(409).json({ error: "schedule_conflict", message: conflictCheck.error });
      return;
    }
  }

  const updatedDiscount = discount !== undefined ? Number(discount) : apt.discount;
  const computedPrice = Array.isArray(serviceIds) ? await calculateAppointmentPrice(serviceIds, updatedDiscount) : undefined;
  const newFinalPrice = finalPrice !== undefined ? Number(finalPrice) : (computedPrice !== undefined ? computedPrice : Number(apt.final_price ?? 0));

  await updateDocById("appointments", id, {
    status: newStatus,
    appointment_date: updatedAppointmentDate,
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

  // Process completion side effects only once with transactional claim.
  if (newStatus === "concluido") {
    const claimed = await claimRevenueProcessing(id);
    if (claimed) {
      try {
        await handleAppointmentCompletion(id, paymentMethod ?? null);
      } catch (err) {
        await updateDocById("appointments", id, { revenue_processed: false, updated_at: nowIso() });
        logger.error({ err, appointmentId: id }, "Failed to process appointment completion");
        res.status(500).json({ error: "internal_error", message: "Falha ao concluir servico" });
        return;
      }
    }
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
