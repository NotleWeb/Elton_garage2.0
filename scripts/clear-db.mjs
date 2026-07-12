/**
 * clear-db.mjs
 * Apaga todos os dados do Firestore, mantendo apenas o usuário admin.
 * Uso: node scripts/clear-db.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve firebase-admin from api-server's node_modules
const require = createRequire(resolve(__dirname, "../artifacts/api-server/package.json"));
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");

// ── Firebase init ──────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
}

const db = getFirestore();

// ── Coleções a apagar ──────────────────────────────────────────────────────

const COLLECTIONS_TO_CLEAR = [
  "appointments",
  "appointment_services",
  "customers",
  "vehicles",
  "services",
  "products",
  "inventory_movements",
  "product_usage",
  "order_services",
  "financial_transactions",
  "loyalty_cards",
  "notifications",
  "_counters",
];

// ── Helpers ────────────────────────────────────────────────────────────────

async function deleteCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) {
    console.log(`  ${colName}: vazio, pulando`);
    return 0;
  }

  let deleted = 0;
  // Deleta em lotes de 400 (limite do Firestore é 500)
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`  ${colName}: ${deleted} documento(s) apagado(s)`);
  return deleted;
}

async function recreateAdminUser() {
  const hash = bcrypt.hashSync("admin123", 10);
  const now = new Date().toISOString();

  // Reserva ID 1 para o admin no _counters
  await db.collection("_counters").doc("users").set({ current: 1 });

  await db.collection("users").doc("1").set({
    name: "Administrador",
    email: "admin@eltongarage.com",
    password_hash: hash,
    role: "admin",
    active: 1,
    created_at: now,
    updated_at: now,
  });

  console.log("  Usuário admin recriado (email: admin@eltongarage.com / senha: admin123)");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("LIMPEZA DO BANCO DE DADOS - ELTON GARAGE");
  console.log("=".repeat(60));
  console.log("\nApagando coleções...\n");

  let totalDeleted = 0;

  // Apaga users separadamente (preservamos só o admin)
  const usersSnap = await db.collection("users").get();
  if (!usersSnap.empty) {
    const batch = db.batch();
    usersSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`  users: ${usersSnap.size} documento(s) apagado(s)`);
    totalDeleted += usersSnap.size;
  } else {
    console.log("  users: vazio, pulando");
  }

  for (const col of COLLECTIONS_TO_CLEAR) {
    totalDeleted += await deleteCollection(col);
  }

  console.log(`\nTotal apagado: ${totalDeleted} documento(s)\n`);

  console.log("Recriando usuário admin...");
  await recreateAdminUser();

  console.log("\n" + "=".repeat(60));
  console.log("Banco limpo com sucesso!");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
