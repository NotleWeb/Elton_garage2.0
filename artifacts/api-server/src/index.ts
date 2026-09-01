import app from "./app";
import { initDb, isDbReady } from "./db";
import { startScheduler } from "./services/scheduler.service";
import { logger } from "./lib/logger";

// ---------------------------------------------------------------------------
// Inicialização da aplicação
// ---------------------------------------------------------------------------
// Este arquivo é o ponto de entrada do backend. Ele valida a porta,
// inicializa o banco de dados e inicia o serviço de agendamento de lembretes.

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function startServer(): Promise<void> {
  const dbInitialized = await initDb();

  app.listen(port, (err?: Error) => {
    if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
    logger.info({ port }, "Server listening");

    if (dbInitialized && isDbReady()) {
      startScheduler();
    } else {
      logger.warn("Server started in degraded mode because Firestore is unavailable");
    }
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to start the server");
  process.exit(1);
});
