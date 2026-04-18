import { Request, Response } from "express";
import { supabase } from "../supabase";

// Listar todas as vítimas
export async function listVictims(req: Request, res: Response) {
  const { data, error } = await supabase
    .from("victims")
    .select(
      `
      *,
      created_by:operators(id, full_name)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}

// Buscar vítima por ID
export async function getVictimById(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("victims")
    .select(
      `
      *,
      trusted_contacts(*),
      created_by:operators(id, full_name)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    res.status(404).json({ error: "Vítima não encontrada" });
    return;
  }

  res.json(data);
}

// Criar vítima
export async function createVictim(req: Request, res: Response) {
  const {
    full_name,
    birth_date,
    cpf,
    phone,
    email,
    address,
    photo_url,
    notes,
  } = req.body;

  if (!full_name) {
    res.status(400).json({ error: "full_name é obrigatório" });
    return;
  }

  const operator = (req as any).user;

  const { data, error } = await supabase
    .from("victims")
    .insert({
      full_name,
      birth_date,
      cpf,
      phone,
      email,
      address,
      photo_url,
      notes,
      created_by: operator.id,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
}

// Atualizar vítima
export async function updateVictim(req: Request, res: Response) {
  const { id } = req.params;
  const fields = req.body;

  const { data, error } = await supabase
    .from("victims")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}
