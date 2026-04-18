import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  listVictims,
  getVictimById,
  createVictim,
  updateVictim,
} from "../controllers/victims.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", listVictims);
router.get("/:id", getVictimById);
router.post("/", createVictim);
router.patch("/:id", updateVictim);

export default router;
