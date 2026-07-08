import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import customersRouter from "./customers.js";
import vehiclesRouter from "./vehicles.js";
import servicesRouter from "./services.js";
import appointmentsRouter from "./appointments.js";
import productsRouter from "./products.js";
import productUsageRouter from "./product-usage.js";
import inventoryRouter from "./inventory.js";
import financialRouter from "./financial.js";
import notificationsRouter from "./notifications.js";
import feedbackRouter from "./feedback.js";
import loyaltyRouter from "./loyalty.js";
import dashboardRouter from "./dashboard.js";
import reportsRouter from "./reports.js";
import backupRouter from "./backup.js";
import { registerOrderServiceRoutes } from "./order-services.js";
import { registerProductUsageRoutes } from "./product-usage.js";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/customers", customersRouter);
router.use("/vehicles", vehiclesRouter);
router.use("/services", servicesRouter);
router.use("/appointments", appointmentsRouter);

// Register nested routes on appointments
registerOrderServiceRoutes(appointmentsRouter);
registerProductUsageRoutes(appointmentsRouter);

router.use("/product-usage", productUsageRouter);
router.use("/products", productsRouter);
router.use("/inventory", inventoryRouter);
router.use("/financial", financialRouter);
router.use("/notifications", notificationsRouter);
router.use("/feedback", feedbackRouter);
router.use("/loyalty", loyaltyRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);
router.use("/backup", backupRouter);

export default router;
