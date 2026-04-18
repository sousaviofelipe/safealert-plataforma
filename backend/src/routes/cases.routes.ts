import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  listCases,
  getCaseById,
  createCase,
  updateCaseStatus,
} from "../controllers/cases.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", listCases);
router.get("/:id", getCaseById);
router.post("/", createCase);
router.patch("/:id/status", updateCaseStatus);

export default router;
