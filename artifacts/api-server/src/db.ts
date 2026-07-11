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
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = (d: Date) => d.toISOString().split("T")[0];

  const c1 = await createDoc("customers", { name: "Carlos Mendonca", phone: "(11) 98765-4321", whatsapp: "(11) 98765-4321", email: "carlos@email.com", address: null, notes: null, total_spent: 1250, total_services: 5, last_service_date: null, created_at: nowIso(), updated_at: nowIso() });
  const c2 = await createDoc("customers", { name: "Maria Aparecida Silva", phone: "(11) 91234-5678", whatsapp: "(11) 91234-5678", email: "maria@email.com", address: null, notes: null, total_spent: 890, total_services: 3, last_service_date: null, created_at: nowIso(), updated_at: nowIso() });
  const c3 = await createDoc("customers", { name: "Roberto Ferreira", phone: "(11) 99876-5432", whatsapp: "(11) 99876-5432", email: "roberto@email.com", address: null, notes: null, total_spent: 2100, total_services: 8, last_service_date: null, created_at: nowIso(), updated_at: nowIso() });

  const v1 = await createDoc("vehicles", { customer_id: (c1 as any).id, brand: "Toyota", model: "Corolla", year: 2021, plate: "ABC-1234", color: "Prata", fuel: "flex", mileage: null, notes: null });
  const v2 = await createDoc("vehicles", { customer_id: (c2 as any).id, brand: "Honda", model: "Civic", year: 2020, plate: "DEF-5678", color: "Preto", fuel: "gasolina", mileage: null, notes: null });
  const v3 = await createDoc("vehicles", { customer_id: (c3 as any).id, brand: "Volkswagen", model: "Amarok", year: 2022, plate: "GHI-9012", color: "Branco", fuel: "diesel", mileage: null, notes: null });

  const s1 = await createDoc("services", { name: "Lavagem Completa", description: "Lavagem externa e interna completa", price: 80, estimated_duration: 60, category: "Lavagem", vehicle_type: "todos", active: 1 });
  const s2 = await createDoc("services", { name: "Polimento Simples", description: "Polimento com maquina de 1 passo", price: 250, estimated_duration: 180, category: "Polimento", vehicle_type: "todos", active: 1 });
  const s3 = await createDoc("services", { name: "Higienizacao Interna", description: "Limpeza e higienizacao do interior", price: 350, estimated_duration: 240, category: "Higienizacao", vehicle_type: "todos", active: 1 });
  const s4 = await createDoc("services", { name: "Vitrificacao", description: "Vitrificacao de pintura com garantia de 1 ano", price: 800, estimated_duration: 480, category: "Protecao", vehicle_type: "todos", active: 1 });
  const s5 = await createDoc("services", { name: "Cristalizacao de Vidros", description: "Tratamento de vidros com produto hidrofobico", price: 120, estimated_duration: 90, category: "Vidros", vehicle_type: "todos", active: 1 });

  await createDoc("products", { name: "Shampoo Automotivo", brand: "Meguiars", supplier: "Distribuidora Auto", purchase_price: 35, sale_price: 60, stock: 15, minimum_stock: 5, unit: "un" });
  await createDoc("products", { name: "Cera Carnauba", brand: "Vonixx", supplier: "Distribuidora Auto", purchase_price: 45, sale_price: 80, stock: 8, minimum_stock: 3, unit: "un" });
  await createDoc("products", { name: "Microfibra Premium", brand: "Autoamerica", supplier: "Distribuidora Auto", purchase_price: 12, sale_price: 25, stock: 3, minimum_stock: 10, unit: "un" });
  await createDoc("products", { name: "Polidor de Corte", brand: "Meguiars", supplier: "Distribuidora Auto", purchase_price: 55, sale_price: 95, stock: 6, minimum_stock: 2, unit: "un" });

  const a1 = await createDoc("appointments", { customer_id: (c1 as any).id, vehicle_id: (v1 as any).id, appointment_date: tomorrow.toISOString(), status: "agendado", discount: 0, final_price: 80, observations: null, created_at: nowIso() });
  const a2 = await createDoc("appointments", { customer_id: (c2 as any).id, vehicle_id: (v2 as any).id, appointment_date: now.toISOString(), status: "em_andamento", discount: 0, final_price: 600, observations: null, created_at: nowIso() });
  const a3 = await createDoc("appointments", { customer_id: (c3 as any).id, vehicle_id: (v3 as any).id, appointment_date: yesterday.toISOString(), status: "concluido", discount: 0, final_price: 920, observations: null, created_at: nowIso() });

  await Promise.all([
    createDoc("appointment_services", { appointment_id: (a1 as any).id, service_id: (s1 as any).id }),
    createDoc("appointment_services", { appointment_id: (a2 as any).id, service_id: (s2 as any).id }),
    createDoc("appointment_services", { appointment_id: (a2 as any).id, service_id: (s3 as any).id }),
    createDoc("appointment_services", { appointment_id: (a3 as any).id, service_id: (s4 as any).id }),
    createDoc("appointment_services", { appointment_id: (a3 as any).id, service_id: (s5 as any).id }),
    createDoc("loyalty_cards", { customer_id: (c1 as any).id, total_washes: 5, current_stamp_count: 5, free_washes_earned: 0, free_washes_used: 0, updated_at: nowIso() }),
    createDoc("loyalty_cards", { customer_id: (c2 as any).id, total_washes: 3, current_stamp_count: 3, free_washes_earned: 0, free_washes_used: 0, updated_at: nowIso() }),
    createDoc("loyalty_cards", { customer_id: (c3 as any).id, total_washes: 8, current_stamp_count: 8, free_washes_earned: 0, free_washes_used: 0, updated_at: nowIso() }),
  ]);

  await createDoc("financial_transactions", { type: "receita", category: "Servicos", description: "Vitrificacao + Cristalizacao - Roberto Ferreira", amount: 920, date: dateStr(yesterday), appointment_id: (a3 as any).id, payment_method: "pix", created_at: nowIso() });
  await createDoc("notifications", { customer_id: (c1 as any).id, title: "Lembrete de Agendamento", message: "Carlos Mendonca tem agendamento amanha.", type: "reminder_1d", read: 0, created_at: nowIso() });
  await createDoc("feedback", { customer_id: (c3 as any).id, appointment_id: (a3 as any).id, rating: 5, comment: "Excelente servico! Carro ficou como novo.", created_at: nowIso() });
}
