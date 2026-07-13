import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, getById } from "../db.js";
import { getLookupHash } from "../lib/data-security.js";

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
  const emailHash = getLookupHash(email);
  if (!emailHash) {
    res.status(400).json({ error: "validation", message: "Email invalido" });
    return;
  }

  let snap = await db.collection("users")
    .where("email_hash", "==", emailHash)
    .where("active", "==", 1)
    .limit(1)
    .get();

  if (snap.empty) {
    // Compatibilidade temporaria para registros antigos sem hash de email.
    snap = await db.collection("users")
      .where("email", "==", email)
      .where("active", "==", 1)
      .limit(1)
      .get();
  }

  if (snap.empty) {
    res.status(401).json({ error: "auth", message: "Credenciais invalidas" });
    return;
  }

  const doc = snap.docs[0];
  const user = await getById("users", Number(doc.id)) as any;
  if (!user) {
    res.status(401).json({ error: "auth", message: "Credenciais invalidas" });
    return;
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
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
