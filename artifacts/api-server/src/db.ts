import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------

const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!svcJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is required");

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(svcJson)) });
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
  return { id, ...snap.data() } as T;
}

/** Get all documents from a collection (integer id field included). */
export async function getAll<T = any>(col: string): Promise<T[]> {
  const snap = await db.collection(col).get();
  return snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })) as T[];
}

/** Create a document with auto-assigned integer ID. */
export async function createDoc<T = any>(col: string, data: Record<string, any>): Promise<T> {
  const id = await nextId(col);
  await db.collection(col).doc(String(id)).set({ ...data });
  return { id, ...data } as T;
}

/** Full overwrite of a document. */
export async function setDocById(col: string, id: number, data: Record<string, any>): Promise<void> {
  await db.collection(col).doc(String(id)).set(data);
}

/** Partial update of a document. */
export async function updateDocById(col: string, id: number, data: Record<string, any>): Promise<void> {
  await db.collection(col).doc(String(id)).update(data);
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
}
