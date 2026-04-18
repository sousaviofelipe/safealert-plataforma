import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  listOffenders,
  getOffenderById,
  createOffender,
  updateOffender,
} from "../controllers/offenders.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", listOffenders);
router.get("/:id", getOffenderById);
router.post("/", createOffender);
router.patch("/:id", updateOffender);

export default router;
