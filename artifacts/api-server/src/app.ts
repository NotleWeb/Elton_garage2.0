import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length > 0
  ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  : true;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit", message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

app.use(helmet());
app.use(cors({ origin: corsOrigin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(apiLimiter);
app.use("/api/auth", authLimiter);

app.use((req, res, next) => {
  const isProd = process.env["NODE_ENV"] === "production";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.secure || forwardedProto === "https";

  if (isProd && !isHttps) {
    res.status(400).json({ error: "https_required", message: "Conexao segura (HTTPS) obrigatoria em producao" });
    return;
  }
  next();
});

app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.includes("CORS")) {
    res.status(403).json({ error: "forbidden", message: "Origem nao permitida" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "server_error", message: "Erro interno do servidor" });
});

export default app;
