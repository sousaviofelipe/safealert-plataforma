import { Request, Response } from "express";
import { supabase } from "../supabase";
import { calculateDistance, getAlertLevel } from "../services/location.service";

export async function recalculateAllCases(req: Request, res: Response) {
  try {
    // Busca todos os casos ativos
    const { data: cases } = await supabase
      .from("cases")
      .select("*, devices(*)")
      .eq("status", "active");

    if (!cases || cases.length === 0) {
      res.json({ status: "ok", updated: 0 });
      return;
    }

    let updated = 0;

    for (const caseData of cases) {
      const devices = caseData.devices || [];
      const offenderDevice = devices.find(
        (d: any) => d.device_type === "ankle_bracelet",
      );
      const victimDevice = devices.find(
        (d: any) =>
          d.device_type === "mobile" || d.device_type === "smartwatch",
      );

      if (!offenderDevice || !victimDevice) continue;

      // Busca última posição do agressor
      const { data: offenderLoc } = await supabase
        .from("locations")
        .select("latitude, longitude")
        .eq("device_id", offenderDevice.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      // Busca última posição da vítima
      const { data: victimLoc } = await supabase
        .from("locations")
        .select("latitude, longitude")
        .eq("device_id", victimDevice.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      if (!offenderLoc || !victimLoc) continue;

      const distance = calculateDistance(
        offenderLoc.latitude,
        offenderLoc.longitude,
        victimLoc.latitude,
        victimLoc.longitude,
      );

      const alertLevel = await getAlertLevel(
        distance,
        caseData.perimeter_meters,
      );

      await supabase
        .from("cases")
        .update({
          current_alert_level: alertLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseData.id);

      console.log(
        `Caso ${caseData.id}: distância=${Math.round(distance)}m, nível=${alertLevel}`,
      );
      updated++;
    }

    res.json({ status: "ok", updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
