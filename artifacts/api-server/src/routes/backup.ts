import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

const COLLECTIONS = [
  "users", "customers", "vehicles", "services", "products",
  "appointments", "appointment_services", "order_services", "product_usage",
  "inventory_movements", "financial_transactions",
  "loyalty_cards", "notifications", "feedback", "_counters",
];

// GET /backup - export all Firestore data as JSON
router.get("/", async (_req, res) => {
  const result: Record<string, any[]> = {};
  await Promise.all(
    COLLECTIONS.map(async (col) => {
      const snap = await db.collection(col).get();
      result[col] = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    })
  );
  const filename = `elton-garage-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json({ exportedAt: new Date().toISOString(), collections: result });
});

export default router;
