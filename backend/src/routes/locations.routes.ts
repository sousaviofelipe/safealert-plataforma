import { Router } from "express";
import { receiveLocation } from "../controllers/locations.controller";

const router = Router();

// Essa rota não usa authMiddleware pois será chamada pela tornozeleira
// A autenticação aqui será feita por API key (implementaremos depois)
router.post("/", receiveLocation);

export default router;
