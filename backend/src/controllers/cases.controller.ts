import { Request, Response } from "express";
import { supabase } from "../supabase";

// Listar todos os casos
export async function listCases(req: Request, res: Response) {
  const { data, error } = await supabase
    .from("cases")
    .select(
      `
      *,
      victim:victims(id, full_name, photo_url, phone),
      offender:offenders(id, full_name, photo_url),
      assigned_operator:operators(id, full_name)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}

// Buscar um caso por ID
export async function getCaseById(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("cases")
    .select(
      `
      *,
      victim:victims(*, trusted_contacts(*)),
      offender:offenders(*),
      assigned_operator:operators(id, full_name),
      devices(*),
      alerts(* , order: created_at.desc, limit: 10)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    res.status(404).json({ error: "Caso não encontrado" });
    return;
  }

  res.json(data);
}

// Criar novo caso
export async function createCase(req: Request, res: Response) {
  const {
    victim_id,
    offender_id,
    court_order_number,
    perimeter_meters,
    assigned_operator_id,
    notes,
  } = req.body;

  if (!victim_id || !offender_id) {
    res.status(400).json({ error: "victim_id e offender_id são obrigatórios" });
    return;
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({
      victim_id,
      offender_id,
      court_order_number,
      perimeter_meters: perimeter_meters || 300,
      assigned_operator_id,
      notes,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(data);
}

// Atualizar status do caso
export async function updateCaseStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["active", "suspended", "closed"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  const { data, error } = await supabase
    .from("cases")
    .update({
      status,
      closed_at: status === "closed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}
