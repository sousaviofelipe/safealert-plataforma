import * as admin from "firebase-admin";
import { readFileSync } from "fs";
import { join } from "path";

// Inicializa o Firebase Admin SDK uma única vez
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, "../firebase-service-account.json"), "utf8"),
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Envia notificação para um único device
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "safealert-alerts",
          priority: "max",
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 250, 250, 250],
          color: "#f87171",
          sound: "default",
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Push enviado com sucesso:", response);
    return response;
  } catch (err: any) {
    console.error("Erro ao enviar push:", err.message);
    throw err;
  }
}

// Envia notificação para múltiplos devices (até 500 por batch)
export async function sendPushNotificationBatch(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (fcmTokens.length === 0) return;

  try {
    const messages: admin.messaging.Message[] = fcmTokens.map((token) => ({
      token,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "safealert-alerts",
          priority: "max",
          defaultVibrateTimings: false,
          vibrateTimingsMillis: [0, 250, 250, 250],
          color: "#f87171",
          sound: "default",
        },
      },
    }));

    // Divide em batches de 500
    const batchSize = 500;
    const batches = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }

    const results = await Promise.all(
      batches.map((batch) => admin.messaging().sendEach(batch)),
    );

    const successCount = results.reduce((acc, r) => acc + r.successCount, 0);
    const failureCount = results.reduce((acc, r) => acc + r.failureCount, 0);

    console.log(`Push batch: ${successCount} enviados, ${failureCount} falhas`);
    return { successCount, failureCount };
  } catch (err: any) {
    console.error("Erro no batch push:", err.message);
    throw err;
  }
}
