import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../db.js";

const router = Router();
router.use(authMiddleware);

const TABLES = [
  "users",
  "customers",
  "vehicles",
  "services",
  "appointments",
  "appointment_services",
  "order_services",
  "products",
  "product_usage",
  "inventory_movements",
  "financial_transactions",
  "notifications",
  "feedback",
  "loyalty_cards",
];

function escapeLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  const str = String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");
  return `'${str}'`;
}

router.get("/export", async (_req: Request, res: Response) => {
  try {
    const lines: string[] = [];
    lines.push("-- Elton Garage — PostgreSQL backup");
    lines.push(`-- Gerado em: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("SET client_encoding = 'UTF8';");
    lines.push("SET standard_conforming_strings = on;");
    lines.push("");

    for (const table of TABLES) {
      const rows = await db.all<Record<string, unknown>>(`SELECT * FROM ${table}`, []);
      lines.push(`-- Tabela: ${table} (${rows.length} registros)`);
      if (rows.length === 0) { lines.push(""); continue; }

      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(", ");
      lines.push(`INSERT INTO "${table}" (${columnList}) VALUES`);

      rows.forEach((row, i) => {
        const vals = columns.map((col) => escapeLiteral(row[col])).join(", ");
        const comma = i < rows.length - 1 ? "," : ";";
        lines.push(`  (${vals})${comma}`);
      });
      lines.push("");
    }

    lines.push("-- Reiniciar sequences");
    for (const table of TABLES) {
      const seqResult = await db.get<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND c.relname = $1) AS exists`,
        [`${table}_id_seq`]
      );
      if (seqResult?.exists) {
        lines.push(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM "${table}"), 1));`);
      }
    }
    lines.push("");
    lines.push("-- Fim do backup");

    const sql = lines.join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="elton_garage_backup_${new Date().toISOString().slice(0, 10)}.sql"`);
    res.send(sql);
  } catch (err) {
    console.error("Erro ao gerar backup:", err);
    res.status(500).json({ error: "server_error", message: "Erro ao gerar backup SQL" });
  }
});

export default router;
