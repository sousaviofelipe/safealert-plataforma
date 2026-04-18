import { Request, Response } from "express";
import { supabase } from "../supabase";

// Listar todos os agressores
export async function listOffenders(req: Request, res: Response) {
  const { data, error } = await supabase
    .from("offenders")
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

// Buscar agressor por ID
export async function getOffenderById(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("offenders")
    .select(
      `
      *,
      created_by:operators(id, full_name),
      cases(id, status, victim:victims(id, full_name))
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    res.status(404).json({ error: "Agressor não encontrado" });
    return;
  }

  res.json(data);
}

// Criar agressor
export async function createOffender(req: Request, res: Response) {
  const { full_name, birth_date, cpf, phone, address, photo_url, notes } =
    req.body;

  if (!full_name) {
    res.status(400).json({ error: "full_name é obrigatório" });
    return;
  }

  const operator = (req as any).user;

  const { data, error } = await supabase
    .from("offenders")
    .insert({
      full_name,
      birth_date,
      cpf,
      phone,
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

// Atualizar agressor
export async function updateOffender(req: Request, res: Response) {
  const { id } = req.params;
  const fields = req.body;

  const { data, error } = await supabase
    .from("offenders")
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
