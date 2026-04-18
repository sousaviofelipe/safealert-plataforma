import { Request, Response } from "express";
import { supabase } from "../supabase";

// Listar alertas ativos
export async function listAlerts(req: Request, res: Response) {
  const { status, case_id } = req.query;

  let query = supabase
    .from("alerts")
    .select(
      `
      *,
      case:cases(
        id,
        perimeter_meters,
        victim:victims(id, full_name, photo_url, phone),
        offender:offenders(id, full_name, photo_url)
      ),
      acknowledged_by:operators(id, full_name)
    `,
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as string);
  if (case_id) query = query.eq("case_id", case_id as string);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
}

// Reconhecer alerta (operador viu e está tratando)
export async function acknowledgeAlert(req: Request, res: Response) {
  const { id } = req.params;
  const operator = (req as any).user;

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: "acknowledged",
      acknowledged_by: operator.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "active")
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Alerta não encontrado ou já reconhecido" });
    return;
  }

  res.json(data);
}

// Resolver alerta (situação controlada)
export async function resolveAlert(req: Request, res: Response) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "resolved")
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Alerta não encontrado ou já resolvido" });
    return;
  }

  // Atualiza o nível do caso para green
  await supabase
    .from("cases")
    .update({
      current_alert_level: "green",
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.case_id);

  res.json(data);
}
