import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db, isDbReady } from "../db.js";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  if (!isDbReady()) {
    res.status(503).json(HealthCheckResponse.parse({ status: "degraded" }));
    return;
  }

  try {
    await db.collection("_health").limit(1).get();
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch {
    res.status(503).json(HealthCheckResponse.parse({ status: "degraded" }));
  }
});

export default router;
