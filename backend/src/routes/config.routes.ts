import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { recalculateAllCases } from "../controllers/config.controller";

const router = Router();

router.use(authMiddleware);
router.post("/recalculate", recalculateAllCases);

export default router;
