import { Request, Response } from "express";
import { processLocation } from "../services/location.service";

// Recebe nova posição de um device
export async function receiveLocation(req: Request, res: Response) {
  const { device_id, latitude, longitude, accuracy_meters } = req.body;

  if (!device_id || latitude === undefined || longitude === undefined) {
    res
      .status(400)
      .json({ error: "device_id, latitude e longitude são obrigatórios" });
    return;
  }

  try {
    await processLocation(device_id, latitude, longitude, accuracy_meters);
    res.json({ status: "ok" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
