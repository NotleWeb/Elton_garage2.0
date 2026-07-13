import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, getAll, getById, createDoc, updateDocById, deleteDocById, nowIso } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { getLookupHash } from "../lib/data-security.js";

const router = Router();
router.use(authMiddleware);

function mapUser(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, createdAt: u.created_at };
}

router.get("/", async (req, res) => {
  const { page = "1", limit = "20", search = "" } = req.query as any;
  const all = await getAll("users");
  const q = (search as string).toLowerCase();
  const filtered = q
    ? all.filter((u: any) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    : all;
  filtered.sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  const total = filtered.length;
  const pg = Number(page);
  const lim = Number(limit);
  const offset = (pg - 1) * lim;
  res.json({
    data: filtered.slice(offset, offset + lim).map(mapUser),
    meta: { total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) },
  });
});

router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body as any;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "validation", message: "Campos obrigatorios faltando" });
    return;
  }

  const emailHash = getLookupHash(email);
  if (!emailHash) {
    res.status(400).json({ error: "validation", message: "Email invalido" });
    return;
  }

  const existingByHash = await db
    .collection("users")
    .where("email_hash", "==", emailHash)
    .limit(1)
    .get();

  const allUsers = await getAll("users");
  const existsLegacy = (allUsers as any[]).some((u: any) => (u.email ?? "") === email);

  if (!existingByHash.empty || existsLegacy) {
    res.status(400).json({ error: "conflict", message: "Email ja cadastrado" });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = await createDoc("users", {
    name, email, password_hash: hash, role, active: 1,
    created_at: nowIso(), updated_at: nowIso(),
  });
  res.status(201).json(mapUser(user));
});

router.get("/:id", async (req, res) => {
  const user = await getById("users", Number(req.params.id));
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuario nao encontrado" }); return; }
  res.json(mapUser(user));
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const user = await getById("users", id) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuario nao encontrado" }); return; }
  const { name, email, password, role, active } = req.body as any;

  if (email !== undefined) {
    const emailHash = getLookupHash(email);
    if (!emailHash) {
      res.status(400).json({ error: "validation", message: "Email invalido" });
      return;
    }
    const existingByHash = await db
      .collection("users")
      .where("email_hash", "==", emailHash)
      .limit(5)
      .get();
    const conflict = existingByHash.docs.some((d) => Number(d.id) !== id);

    const allUsers = await getAll("users");
    const legacyConflict = (allUsers as any[]).some((u: any) => u.id !== id && (u.email ?? "") === email);

    if (conflict || legacyConflict) {
      res.status(400).json({ error: "conflict", message: "Email ja cadastrado" });
      return;
    }
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  await updateDocById("users", id, {
    name: name ?? user.name,
    email: email ?? user.email,
    password_hash: newHash,
    role: role ?? user.role,
    active: active !== undefined ? (active ? 1 : 0) : user.active,
    updated_at: nowIso(),
  });
  const updated = await getById("users", id);
  res.json(mapUser(updated));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await getById("users", id)) {
    res.status(404).json({ error: "not_found", message: "Usuario nao encontrado" });
    return;
  }
  await deleteDocById("users", id);
  res.json({ message: "Usuario removido com sucesso" });
});

export default router;
