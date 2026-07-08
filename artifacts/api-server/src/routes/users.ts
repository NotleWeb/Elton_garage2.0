import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, createdAt: u.created_at };
}

router.get("/", (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const total = (db.prepare("SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR email LIKE ?").get(like, like) as any).c;
  const data = db.prepare("SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY name LIMIT ? OFFSET ?").all(like, like, Number(limit), offset);
  res.json({ data: data.map(mapUser), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", (req, res) => {
  const { name, email, password, role } = req.body as any;
  if (!name || !email || !password || !role) { res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" }); return; }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run(name, email, hash, role);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as any;
    res.status(201).json(mapUser(user));
  } catch (e: any) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") { res.status(400).json({ error: "conflict", message: "Email já cadastrado" }); } else { res.status(500).json({ error: "server_error", message: "Erro interno" }); }
  }
});

router.get("/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.params.id)) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  res.json(mapUser(user));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, email, password, role, active } = req.body as any;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  db.prepare("UPDATE users SET name=?, email=?, password_hash=?, role=?, active=?, updated_at=datetime('now') WHERE id=?")
    .run(name ?? user.name, email ?? user.email, newHash, role ?? user.role, active !== undefined ? (active ? 1 : 0) : user.active, id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  res.json(mapUser(updated));
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ message: "Usuário removido com sucesso" });
});

export default router;
