import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
} from "../controllers/alerts.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", listAlerts);
router.patch("/:id/acknowledge", acknowledgeAlert);
router.patch("/:id/resolve", resolveAlert);

export default router;
