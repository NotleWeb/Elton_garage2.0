import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Autenticação via JWT
// ---------------------------------------------------------------------------
// Este middleware valida o token enviado no cabeçalho Authorization.
// Em seguida, anexa o identificador e a role do usuário à requisição,
// permitindo que rotas protegidas verifiquem permissões e identidade.

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but not set");
}
const JWT_SECRET: string = process.env.SESSION_SECRET;

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Token não fornecido" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Token inválido ou expirado" });
  }
}

export function generateToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}
