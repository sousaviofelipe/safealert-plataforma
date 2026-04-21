import { Request, Response } from "express";
import { supabase } from "../supabase";
import { sendPushNotification } from "../services/push.service";

export async function sendMessagePush(req: Request, res: Response) {
  const { case_id, content } = req.body;

  if (!case_id || !content) {
    res.status(400).json({ error: "case_id e content são obrigatórios" });
    return;
  }

  try {
    // Busca o device mobile do caso com fcm_token
    const { data: device } = await supabase
      .from("devices")
      .select("fcm_token")
      .eq("case_id", case_id)
      .eq("device_type", "mobile")
      .not("fcm_token", "is", null)
      .single();

    if (!device?.fcm_token) {
      res.status(404).json({ error: "Device não encontrado ou sem token FCM" });
      return;
    }

    await sendPushNotification(
      device.fcm_token,
      "💬 Mensagem da central",
      content,
      { type: "message", case_id },
    );

    res.json({ status: "ok" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
