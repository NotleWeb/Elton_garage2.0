import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

// ---------------------------------------------------------------------------
// Configuração principal da API
// ---------------------------------------------------------------------------
// Este arquivo monta a aplicação Express, define regras de segurança,
// configura CORS, rate limiting e registra todas as rotas do sistema.
// Ele atua como o ponto de entrada da camada de backend do sistema.

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// Lista de domínios permitidos para acessar a API.
// Em produção, esta configuração restringe acessos externos e reduz riscos.
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Política de CORS: aceita apenas origens autorizadas quando configuradas.
const corsOrigin = allowedOrigins.length > 0
  ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    }
  : true;

// Limite global para evitar abuso e ataques de força bruta na API.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite específico para login e autenticação, para reduzir tentativas repetidas.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit", message: "Muitas tentativas. Tente novamente em alguns minutos." },
});

// Middleware de logging: registra requisições HTTP com identificação única.
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// Helmet reforça cabeçalhos HTTP e reduz vulnerabilidades web comuns.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", ...(allowedOrigins.length > 0 ? allowedOrigins : ["*"])],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors({ 
  origin: corsOrigin, 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(apiLimiter);
app.use("/api/auth", authLimiter);

// Garante que a aplicação só aceite conexões HTTPS em produção.
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

// Roteador principal da aplicação. Todas as rotas da API são agrupadas aqui.
app.use("/api", router);

// Middleware final para padronizar erros internos e retornar respostas úteis.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.includes("CORS")) {
    res.status(403).json({ error: "forbidden", message: "Origem nao permitida" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "server_error", message: "Erro interno do servidor" });
});

export default app;
