import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware);

function mapUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, createdAt: u.created_at };
}

router.get("/", async (req, res) => {
  const { page = 1, limit = 20, search = "" } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const like = `%${search}%`;
  const total = Number((await db.get("SELECT COUNT(*) as c FROM users WHERE name ILIKE $1 OR email ILIKE $2", [like, like]))?.c ?? 0);
  const data = await db.all("SELECT * FROM users WHERE name ILIKE $1 OR email ILIKE $2 ORDER BY name LIMIT $3 OFFSET $4", [like, like, Number(limit), offset]);
  res.json({ data: data.map(mapUser), meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } });
});

router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body as any;
  if (!name || !email || !password || !role) { res.status(400).json({ error: "validation", message: "Campos obrigatórios faltando" }); return; }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = await db.run("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id", [name, email, hash, role]);
    const user = await db.get("SELECT * FROM users WHERE id = $1", [result.id]) as any;
    res.status(201).json(mapUser(user));
  } catch (e: any) {
    if (e.code === "23505") { res.status(400).json({ error: "conflict", message: "Email já cadastrado" }); }
    else { res.status(500).json({ error: "server_error", message: "Erro interno" }); }
  }
});

router.get("/:id", async (req, res) => {
  const user = await db.get("SELECT * FROM users WHERE id = $1", [Number(req.params.id)]) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  res.json(mapUser(user));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const user = await db.get("SELECT * FROM users WHERE id = $1", [id]) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  const { name, email, password, role, active } = req.body as any;
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  await db.run(
    "UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, active=$5, updated_at=$6 WHERE id=$7",
    [name ?? user.name, email ?? user.email, newHash, role ?? user.role, active !== undefined ? (active ? 1 : 0) : user.active, new Date().toISOString(), id]
  );
  const updated = await db.get("SELECT * FROM users WHERE id = $1", [id]) as any;
  res.json(mapUser(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.get("SELECT id FROM users WHERE id = $1", [id])) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  await db.run("DELETE FROM users WHERE id = $1", [id]);
  res.json({ message: "Usuário removido com sucesso" });
});

export default router;
