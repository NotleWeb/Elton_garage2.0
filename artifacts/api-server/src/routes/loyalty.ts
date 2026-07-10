import { Router } from "express";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapLoyalty(l: any) {
  return {
    id: l.id, customerId: l.customer_id, totalWashes: l.total_washes, currentStampCount: l.current_stamp_count,
    freeWashesEarned: l.free_washes_earned, freeWashesUsed: l.free_washes_used,
    freeWashesPending: l.free_washes_earned - l.free_washes_used, updatedAt: l.updated_at,
    customer: l.cname ? { id: l.customer_id, name: l.cname, phone: l.cphone } : undefined,
  };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, freeWashPending } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  let where = "WHERE 1=1";
  const params: any[] = [];
  if (freeWashPending === "true") { where += " AND (lc.free_washes_earned - lc.free_washes_used) > 0"; }
  const total = Number((await db.get(`SELECT COUNT(*) as c FROM loyalty_cards lc ${where}`, params))?.c ?? 0);
  const data = await db.all(`SELECT lc.*, c.name as cname, c.phone as cphone FROM loyalty_cards lc JOIN customers c ON c.id = lc.customer_id ${where} ORDER BY lc.total_washes DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, Number(limit), offset]);
  res.json({ data: data.map(mapLoyalty), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/:customerId/redeem", async (req, res) => {
  const customerId = Number(req.params.customerId);
  const loyalty = await db.get("SELECT * FROM loyalty_cards WHERE customer_id = $1", [customerId]) as any;
  if (!loyalty) { res.status(404).json({ error: "not_found", message: "Cartão de fidelidade não encontrado" }); return; }
  const pending = loyalty.free_washes_earned - loyalty.free_washes_used;
  if (pending <= 0) { res.status(400).json({ error: "no_reward", message: "Nenhuma lavagem grátis disponível" }); return; }
  await db.run("UPDATE loyalty_cards SET free_washes_used = free_washes_used + 1, updated_at = $1 WHERE customer_id = $2", [new Date().toISOString(), customerId]);
  const updated = await db.get("SELECT lc.*, c.name as cname, c.phone as cphone FROM loyalty_cards lc JOIN customers c ON c.id = lc.customer_id WHERE lc.customer_id = $1", [customerId]) as any;
  res.json(mapLoyalty(updated));
});

export default router;
