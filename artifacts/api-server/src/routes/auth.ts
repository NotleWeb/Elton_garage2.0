import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { authMiddleware, generateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "validation", message: "Email e senha são obrigatórios" });
    return;
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "unauthorized", message: "Credenciais inválidas" });
    return;
  }
  const token = generateToken(user.id, user.role);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, active: !!user.active, createdAt: user.created_at },
  });
});

router.post("/logout", authMiddleware, (_req, res) => {
  res.json({ message: "Logout realizado com sucesso" });
});

router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId) as any;
  if (!user) { res.status(404).json({ error: "not_found", message: "Usuário não encontrado" }); return; }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, active: !!user.active, createdAt: user.created_at });
});

export default router;
