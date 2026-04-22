import { supabase } from "../supabase";
import { sendPushNotification } from "./push.service";
import { getNumberConfig } from "./config.service";

// Calcula distância entre dois pontos GPS em metros (fórmula de Haversine)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // raio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Determina o nível de alerta com base na distância e no perímetro
export async function getAlertLevel(
  distanceMeters: number,
  perimeterMeters: number,
): Promise<"green" | "yellow" | "red"> {
  const multiplier = await getNumberConfig("alert_yellow_multiplier", 1.5);
  console.log(
    `getAlertLevel: distancia=${distanceMeters}m, perimetro=${perimeterMeters}m, multiplicador=${multiplier}`,
  );
  if (distanceMeters <= perimeterMeters) return "red";
  if (distanceMeters <= perimeterMeters * multiplier) return "yellow";
  return "green";
}

// Processa nova posição recebida de um dispositivo
export async function processLocation(
  deviceId: string,
  latitude: number,
  longitude: number,
  accuracyMeters?: number,
) {
  console.log(
    `processLocation: device=${deviceId}, lat=${latitude}, lng=${longitude}`,
  );

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("*, case:cases(*, devices(*))")
    .eq("id", deviceId)
    .single();

  if (deviceError || !device) {
    console.log("Device não encontrado:", deviceError);
    throw new Error("Device não encontrado");
  }

  console.log(
    `Device encontrado: tipo=${device.device_type}, case=${device.case?.id}, status=${device.case?.status}`,
  );

  const caseData = device.case;

  if (!caseData || caseData.status !== "active") {
    console.log(`Caso inativo ou não encontrado: ${caseData?.status}`);
    return;
  }

  await supabase.from("locations").insert({
    device_id: deviceId,
    case_id: caseData.id,
    latitude,
    longitude,
    accuracy_meters: accuracyMeters,
  });

  await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", deviceId);

  if (device.device_type !== "ankle_bracelet") {
    console.log("Device não é tornozeleira, ignorando cálculo de distância");
    return;
  }

  const victimDevice = caseData.devices.find(
    (d: any) => d.device_type === "mobile" || d.device_type === "smartwatch",
  );

  console.log(`Device da vítima encontrado: ${JSON.stringify(victimDevice)}`);

  if (!victimDevice) {
    console.log("Nenhum device da vítima encontrado");
    return;
  }

  const { data: lastVictimLocation } = await supabase
    .from("locations")
    .select("latitude, longitude")
    .eq("device_id", victimDevice.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  console.log(
    `Última localização da vítima: ${JSON.stringify(lastVictimLocation)}`,
  );

  if (!lastVictimLocation) {
    console.log("Nenhuma localização da vítima encontrada");
    return;
  }

  const distance = calculateDistance(
    latitude,
    longitude,
    lastVictimLocation.latitude,
    lastVictimLocation.longitude,
  );

  console.log(
    `Distância: ${distance}m | Perímetro: ${caseData.perimeter_meters}m`,
  );
  const alertLevel = await getAlertLevel(distance, caseData.perimeter_meters);
  console.log(`Nível calculado: ${alertLevel}`);

  await supabase
    .from("cases")
    .update({
      current_alert_level: alertLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseData.id);

  // Se o nível mudou para fora do vermelho, resolve alertas ativos de perímetro
  if (alertLevel !== "red") {
    await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("case_id", caseData.id)
      .eq("alert_type", "perimeter_breach")
      .eq("status", "active");
  }

  if (alertLevel === "red" || alertLevel === "yellow") {
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("id, alert_level")
      .eq("case_id", caseData.id)
      .in("alert_type", ["perimeter_breach", "proximity_warning"])
      .eq("status", "active")
      .single();

    if (!existingAlert) {
      const isRed = alertLevel === "red";

      await supabase.from("alerts").insert({
        case_id: caseData.id,
        alert_type: isRed ? "perimeter_breach" : "proximity_warning",
        alert_level: alertLevel,
        status: "active",
        distance_meters: distance,
        offender_latitude: latitude,
        offender_longitude: longitude,
        victim_latitude: lastVictimLocation.latitude,
        victim_longitude: lastVictimLocation.longitude,
      });

      const victimMobileDevice = caseData.devices.find(
        (d: any) => d.device_type === "mobile" && d.fcm_token,
      );
      if (victimMobileDevice?.fcm_token) {
        await sendPushNotification(
          victimMobileDevice.fcm_token,
          isRed ? "🚨 ALERTA DE SEGURANÇA" : "⚠️ Atenção — Agressor próximo",
          isRed
            ? `Agressor está a ${Math.round(distance)}m de você. Afaste-se imediatamente.`
            : `Agressor está a ${Math.round(distance)}m de você. Fique atenta.`,
          {
            alert_type: isRed ? "perimeter_breach" : "proximity_warning",
            distance_meters: String(Math.round(distance)),
          },
        );
      }
    }
  }
}
