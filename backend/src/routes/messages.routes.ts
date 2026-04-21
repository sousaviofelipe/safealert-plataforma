import { Router } from "express";
import { sendMessagePush } from "../controllers/messages.controller";

const router = Router();

router.post("/push", sendMessagePush);

export default router;
