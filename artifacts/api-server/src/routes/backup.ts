import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "..", "elton_garage.db");

const router = Router();
router.use(authMiddleware);
const upload = multer({ dest: "/tmp/backup_uploads/" });

router.get("/export", (_req, res) => {
  if (!fs.existsSync(DB_PATH)) { res.status(404).json({ error: "not_found", message: "Banco de dados não encontrado" }); return; }
  res.download(DB_PATH, "elton_garage_backup.db");
});

router.post("/restore", upload.single("file"), (req, res) => {
  if (!req.file) { res.status(400).json({ error: "validation", message: "Arquivo não fornecido" }); return; }
  try {
    fs.copyFileSync(req.file.path, DB_PATH);
    fs.unlinkSync(req.file.path);
    res.json({ message: "Banco de dados restaurado com sucesso. Reinicie o servidor." });
  } catch (e) {
    res.status(500).json({ error: "server_error", message: "Erro ao restaurar backup" });
  }
});

export default router;
