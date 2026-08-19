import app from "./app";
import { initDb } from "./db";
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

// A inicialização do banco garante o usuário administrador padrão e os dados iniciais.
initDb()
  .then(() => {
    app.listen(port, (err?: Error) => {
      if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
      logger.info({ port }, "Server listening");
      startScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
    process.exit(1);
  });
