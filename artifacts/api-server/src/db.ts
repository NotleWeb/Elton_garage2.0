import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";
import { SECURED_COLLECTIONS, secureDataForRead, secureDataForWrite } from "./lib/data-security.js";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------

if (!getApps().length) {
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (svcJson) {
    initializeApp({ credential: cert(JSON.parse(svcJson)) });
  } else if (svcPath) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(svcPath, "utf8"))) });
  } else {
    initializeApp({ credential: applicationDefault() });
  }
}

export const db = getFirestore();

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export function nowIso(): string {
  return new Date().toISOString();
}

/** Auto-increment ID using a _counters collection */
export async function nextId(collection: string): Promise<number> {
  const ref = db.collection("_counters").doc(collection);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current: number = snap.exists ? (snap.data()!.current as number) : 0;
    const next = current + 1;
    t.set(ref, { current: next });
    return next;
  });
}

/** Get a document by integer ID. Returns null if not found. */
export async function getById<T = any>(col: string, id: number): Promise<T | null> {
  const snap = await db.collection(col).doc(String(id)).get();
  if (!snap.exists) return null;
  const data = secureDataForRead(col, snap.data() as Record<string, unknown>);
  return { id, ...data } as T;
}

/** Get all documents from a collection (integer id field included). */
export async function getAll<T = any>(col: string): Promise<T[]> {
  const snap = await db.collection(col).get();
  return snap.docs.map((d) => {
    const data = secureDataForRead(col, d.data() as Record<string, unknown>);
    return { id: Number(d.id), ...data };
  }) as T[];
}

/** Create a document with auto-assigned integer ID. */
export async function createDoc<T = any>(col: string, data: Record<string, any>): Promise<T> {
  const id = await nextId(col);
  const writeData = secureDataForWrite(col, { ...data });
  await db.collection(col).doc(String(id)).set(writeData);
  return { id, ...secureDataForRead(col, writeData) } as T;
}

/** Full overwrite of a document. */
export async function setDocById(col: string, id: number, data: Record<string, any>): Promise<void> {
  const writeData = secureDataForWrite(col, data);
  await db.collection(col).doc(String(id)).set(writeData);
}

/** Partial update of a document. */
export async function updateDocById(col: string, id: number, data: Record<string, any>): Promise<void> {
  const writeData = secureDataForWrite(col, data);
  await db.collection(col).doc(String(id)).update(writeData);
}

/** Delete a document by integer ID. */
export async function deleteDocById(col: string, id: number): Promise<void> {
  await db.collection(col).doc(String(id)).delete();
}

// ---------------------------------------------------------------------------
// Database initialisation: seed admin user + demo data
// ---------------------------------------------------------------------------

export async function initDb(): Promise<void> {
  const adminSnap = await db
    .collection("users")
    .where("email", "==", "admin@eltongarage.com")
    .limit(1)
    .get();

  if (adminSnap.empty) {
    const hash = bcrypt.hashSync("admin123", 10);
    await createDoc("users", {
      name: "Administrador",
      email: "admin@eltongarage.com",
      password_hash: hash,
      role: "admin",
      active: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  if ((process.env["RUN_DATA_SECURITY_MIGRATION"] ?? "false").toLowerCase() === "true") {
    await migrateSensitiveData();
  }

  await reconcileLoyaltyCards();
}

async function reconcileLoyaltyCards(): Promise<void> {
  const [appointmentsSnap, linksSnap, servicesSnap, cardsSnap] = await Promise.all([
    db.collection("appointments").where("status", "==", "concluido").get(),
    db.collection("appointment_services").get(),
    db.collection("services").get(),
    db.collection("loyalty_cards").get(),
  ]);
  const serviceCategory = new Map(
    servicesSnap.docs.map((doc) => [Number(doc.id), String((doc.data() as any).category ?? "").toLowerCase()]),
  );
  const serviceIdsByAppointment = new Map<number, number[]>();
  for (const link of linksSnap.docs) {
    const data = link.data() as any;
    const appointmentId = Number(data.appointment_id);
    const serviceIds = serviceIdsByAppointment.get(appointmentId) ?? [];
    serviceIds.push(Number(data.service_id));
    serviceIdsByAppointment.set(appointmentId, serviceIds);
  }
  const washesByCustomer = new Map<number, number>();
  for (const appointment of appointmentsSnap.docs) {
    const data = appointment.data() as any;
    const serviceIds = serviceIdsByAppointment.get(Number(appointment.id)) ?? [];
    const isWash = serviceIds.some((serviceId) => serviceCategory.get(serviceId)?.includes("lavagem"));
    if (isWash) {
      const customerId = Number(data.customer_id);
      washesByCustomer.set(customerId, (washesByCustomer.get(customerId) ?? 0) + 1);
    }
  }

  const batch = db.batch();
  for (const card of cardsSnap.docs) {
    const data = card.data() as any;
    const totalWashes = washesByCustomer.get(Number(data.customer_id)) ?? 0;
    const freeWashesEarned = Math.floor(totalWashes / 10);
    batch.update(card.ref, {
      total_washes: totalWashes,
      current_stamp_count: totalWashes % 10,
      free_washes_earned: Math.max(freeWashesEarned, Number(data.free_washes_used ?? 0)),
      updated_at: nowIso(),
    });
  }
  if (cardsSnap.size > 0) await batch.commit();
}

async function migrateSensitiveData(): Promise<void> {
  for (const collectionName of SECURED_COLLECTIONS) {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) continue;

    let pendingWrites = 0;
    let batch = db.batch();

    for (const doc of snap.docs) {
      const raw = doc.data() as Record<string, any>;
      const secured = secureDataForWrite(collectionName, raw);

      if (JSON.stringify(raw) === JSON.stringify(secured)) continue;

      batch.set(doc.ref, secured, { merge: true });
      pendingWrites += 1;

      if (pendingWrites >= 300) {
        await batch.commit();
        batch = db.batch();
        pendingWrites = 0;
      }
    }

    if (pendingWrites > 0) {
      await batch.commit();
    }
  }
}
