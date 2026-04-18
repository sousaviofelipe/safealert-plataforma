import "dotenv/config";
import express from "express";
import cors from "cors";
import casesRoutes from "./routes/cases.routes";
import victimsRoutes from "./routes/victims.routes";
import offendersRoutes from "./routes/offenders.routes";
import locationsRoutes from "./routes/locations.routes";
import alertsRoutes from "./routes/alerts.routes";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globais
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rotas
app.use("/cases", casesRoutes);
app.use("/victims", victimsRoutes);
app.use("/offenders", offendersRoutes);
app.use("/locations", locationsRoutes);
app.use("/alerts", alertsRoutes);

app.listen(PORT, () => {
  console.log(`SafeAlert backend rodando na porta ${PORT}`);
});

export default app;
