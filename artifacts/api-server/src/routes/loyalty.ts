import { Router } from "express";
import { getAll, getById, updateDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function toLoyalty(l: any, custMap: Map<number, any>) {
  const c = custMap.get(l.customer_id);
  return {
    id: l.id, customerId: l.customer_id,
    totalWashes: l.total_washes, currentStampCount: l.current_stamp_count,
    freeWashesEarned: l.free_washes_earned, freeWashesUsed: l.free_washes_used,
    freeWashesPending: l.free_washes_earned - l.free_washes_used,
    updatedAt: l.updated_at,
    customer: c ? { id: c.id, name: c.name, phone: c.phone } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", freeWashPending } = req.query as any;
  const [loyalties, customers] = await Promise.all([getAll("loyalty_cards"), getAll("customers")]);
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  let filtered = loyalties as any[];
  if (freeWashPending === "true") filtered = filtered.filter((l: any) => (l.free_washes_earned - l.free_washes_used) > 0);
  filtered.sort((a: any, b: any) => b.total_washes - a.total_washes);
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  res.json({
    data: filtered.slice((pg - 1) * lim, pg * lim).map((l: any) => toLoyalty(l, custMap as any)),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

router.post("/:customerId/redeem", async (req, res) => {
  const customerId = Number(req.params.customerId);
  const all = await getAll("loyalty_cards") as any[];
  const loyalty = all.find((l: any) => l.customer_id === customerId);
  if (!loyalty) {
    res.status(404).json({ error: "not_found", message: "Cartao de fidelidade nao encontrado" });
    return;
  }
  const pending = loyalty.free_washes_earned - loyalty.free_washes_used;
  if (pending <= 0) {
    res.status(400).json({ error: "no_reward", message: "Nenhuma lavagem gratis disponivel" });
    return;
  }
  await updateDocById("loyalty_cards", loyalty.id, {
    free_washes_used: loyalty.free_washes_used + 1,
    updated_at: nowIso(),
  });
  const [updated, customers] = await Promise.all([getById("loyalty_cards", loyalty.id), getAll("customers")]);
  const custMap = new Map((customers as any[]).map((c: any) => [c.id, c]));
  res.json(toLoyalty(updated, custMap as any));
});

export default router;
