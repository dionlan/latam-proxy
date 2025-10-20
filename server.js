import express from "express";
import cors from "cors";
import tokenRoutes from "./src/api/token/oferta-voos.js";
import searchRoutes from "./src/api/search/search.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "https://viajante-de-plantao.vercel.app",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rotas
app.use("/api/token/oferta-voos", tokenRoutes);
app.use("/api/search", searchRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    message: "LATAM Proxy API",
    version: "1.0.0",
    endpoints: {
      token: "/api/token/oferta-voos",
      search: "/api/search",
    },
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Erro não tratado:", error);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
    message: error.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor LATAM Proxy rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
