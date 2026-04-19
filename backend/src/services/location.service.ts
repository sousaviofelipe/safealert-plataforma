import { supabase } from "../supabase";
import { sendPushNotification } from "./push.service";

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
export function getAlertLevel(
  distanceMeters: number,
  perimeterMeters: number,
): "green" | "yellow" | "red" {
  if (distanceMeters <= perimeterMeters) return "red";
  if (distanceMeters <= perimeterMeters * 1.5) return "yellow";
  return "green";
}

// Processa nova posição recebida de um dispositivo
export async function processLocation(
  deviceId: string,
  latitude: number,
  longitude: number,
  accuracyMeters?: number,
) {
  // 1. Busca o device e o caso vinculado
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("*, case:cases(*, devices(*))")
    .eq("id", deviceId)
    .single();

  if (deviceError || !device) {
    throw new Error("Device não encontrado");
  }

  const caseData = device.case;

  if (!caseData || caseData.status !== "active") return;

  // 2. Salva a posição no histórico
  await supabase.from("locations").insert({
    device_id: deviceId,
    case_id: caseData.id,
    latitude,
    longitude,
    accuracy_meters: accuracyMeters,
  });

  // 3. Atualiza o last_seen_at do device
  await supabase
    .from("devices")
    .update({ last_seen_at: new Date().toISOString(), status: "online" })
    .eq("id", deviceId);

  // 4. Se for tornozeleira, verifica proximidade com a vítima
  if (device.device_type !== "ankle_bracelet") return;

  // Busca a última posição conhecida do device da vítima (mobile ou smartwatch)
  const victimDevice = caseData.devices.find(
    (d: any) => d.device_type === "mobile" || d.device_type === "smartwatch",
  );

  if (!victimDevice) return;

  const { data: lastVictimLocation } = await supabase
    .from("locations")
    .select("latitude, longitude")
    .eq("device_id", victimDevice.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastVictimLocation) return;

  // 5. Calcula distância
  const distance = calculateDistance(
    latitude,
    longitude,
    lastVictimLocation.latitude,
    lastVictimLocation.longitude,
  );

  const alertLevel = getAlertLevel(distance, caseData.perimeter_meters);

  // 6. Atualiza o nível de alerta do caso
  await supabase
    .from("cases")
    .update({
      current_alert_level: alertLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseData.id);

  // 7. Se entrou no perímetro, cria um alerta
  if (alertLevel === "red") {
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("id")
      .eq("case_id", caseData.id)
      .eq("alert_type", "perimeter_breach")
      .eq("status", "active")
      .single();

    // Evita criar alertas duplicados se já existe um ativo
    if (!existingAlert) {
      await supabase.from("alerts").insert({
        case_id: caseData.id,
        alert_type: "perimeter_breach",
        alert_level: "red",
        status: "active",
        distance_meters: distance,
        offender_latitude: latitude,
        offender_longitude: longitude,
        victim_latitude: lastVictimLocation.latitude,
        victim_longitude: lastVictimLocation.longitude,
      });
    }
  }
}
