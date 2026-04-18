import { Request, Response, NextFunction } from "express";
import { supabase } from "../supabase";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  // Anexa o usuário na requisição para uso nas rotas
  (req as any).user = data.user;

  next();
}
