import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { createVictimWithAccess } from "../controllers/victims.auth.controller";

const router = Router();

router.use(authMiddleware);
router.post("/", createVictimWithAccess);

export default router;
