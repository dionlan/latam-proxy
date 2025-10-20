import express from "express";
import cors from "cors";
import tokenRoutes from "./src/api/token/oferta-voos.js";
import searchRoutes from "./src/api/search/search.js";
import completeSearchRoutes from "./src/api/complete-search.js";

// Carrega variáveis de ambiente
import dotenv from "dotenv";
dotenv.config();

// Logo após carregar dotenv
console.log("🔍 DEBUG - Variáveis de ambiente:");
console.log("   NODE_ENV:", process.env.NODE_ENV);
console.log("   PORT:", process.env.PORT);
console.log("   ALLOWED_ORIGINS:", process.env.ALLOWED_ORIGINS);
console.log("   ENABLE_LOGGING:", process.env.ENABLE_LOGGING);

const app = express();
const PORT = process.env.PORT || 3001;

// Log das variáveis de ambiente (sem valores sensíveis)
console.log("🔧 Configuração do Ambiente:");
console.log("   NODE_ENV:", process.env.NODE_ENV);
console.log("   PORT:", process.env.PORT);
console.log(
  "   RAILWAY_PROXY_URL:",
  process.env.RAILWAY_PROXY_URL ? "Configurada" : "Não configurada"
);
console.log(
  "   ALLOWED_ORIGINS:",
  process.env.ALLOWED_ORIGINS ? "Configurado" : "Não configurado"
);

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

// Logging middleware melhorado
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (Object.keys(req.query).length > 0) {
    console.log("   Query:", req.query);
  }
  if (Object.keys(req.body).length > 0) {
    console.log("   Body:", JSON.stringify(req.body).substring(0, 200) + "...");
  }
  next();
});

// Rotas
app.use("/api/token/oferta-voos", tokenRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/complete-search", completeSearchRoutes);

// Health check detalhado
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    railwayUrl: process.env.RAILWAY_PROXY_URL || "Não configurada",
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// Rota raiz com informações
app.get("/", (req, res) => {
  res.json({
    message: "LATAM Proxy API - Railway",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      token: "/api/token/oferta-voos",
      search: "/api/search",
      completeSearch: "/api/complete-search",
      health: "/health",
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
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ Rota não encontrada:", req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor LATAM Proxy rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(
    `🚄 Railway Proxy: ${process.env.RAILWAY_PROXY_URL || "Não configurado"}`
  );
  console.log(
    `🌐 Origins permitidos: ${process.env.ALLOWED_ORIGINS || "Padrão"}`
  );
});
