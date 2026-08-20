import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, getById, getAll } from "../db.js";
import { getLookupHash, secureDataForRead } from "../lib/data-security.js";

const router = Router();

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
  return secret;
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body as any;
  if (!email || !password) {
    res.status(400).json({ error: "validation", message: "Email e senha sao obrigatorios" });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const emailHash = getLookupHash(normalizedEmail);
  if (!emailHash) {
    res.status(400).json({ error: "validation", message: "Email invalido" });
    return;
  }

  let snap = await db.collection("users")
    .where("email_hash", "==", emailHash)
    .limit(1)
    .get();

  if (snap.empty) {
    // Compatibilidade temporaria para registros antigos sem hash de email.
    snap = await db.collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
  }

  let user: any = null;
  if (!snap.empty) {
    const doc = snap.docs[0];
    user = {
      id: Number(doc.id),
      ...secureDataForRead("users", doc.data() as Record<string, unknown>),
    } as any;
  }

  if (!user) {
    const users = await getAll("users") as any[];
    user = users.find((u) => String(u.email ?? "").trim().toLowerCase() === normalizedEmail) ?? null;
  }

  if (!user || !(user.active === 1 || user.active === true)) {
    res.status(401).json({ error: "auth", message: "Credenciais invalidas" });
    return;
  }

  const passwordHash = user.password_hash ?? user.passwordHash;
  if (!passwordHash) {
    res.status(401).json({ error: "auth", message: "Credenciais invalidas" });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, String(passwordHash));
  if (!passwordMatches) {
    res.status(401).json({ error: "auth", message: "Credenciais invalidas" });
    return;
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout realizado com sucesso" });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || (req as any).cookies?.token;
  if (!token) {
    res.status(401).json({ error: "auth", message: "Nao autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    const user = await getById("users", Number(payload.userId)) as any;
    if (!user) {
      res.status(404).json({ error: "not_found", message: "Usuario nao encontrado" });
      return;
    }
    if (!user.active) {
      res.status(401).json({ error: "auth", message: "Usuario inativo" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch {
    res.status(401).json({ error: "auth", message: "Token invalido" });
  }
});

export default router;
