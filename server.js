import express from "express";
import cors from "cors";
import tokenRoutes from "./src/api/token/oferta-voos.js";
import searchRoutes from "./src/api/search/search.js";
import completeSearchRoutes from "./src/api/complete-search.js";

// Carrega variáveis de ambiente (apenas para desenvolvimento)
import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// Configurações com fallbacks robustos
const config = {
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT || 3001,
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS ||
    "https://viajante-de-plantao.vercel.app,http://localhost:3000",
  ENABLE_LOGGING: process.env.ENABLE_LOGGING || "true",
  DEBUG: process.env.DEBUG || "true",
};

// Log das configurações
console.log("🔧 CONFIGURAÇÃO DO AMBIENTE:");
console.log("   NODE_ENV:", config.NODE_ENV);
console.log("   PORT:", config.PORT);
console.log("   ALLOWED_ORIGINS:", config.ALLOWED_ORIGINS);
console.log("   ENABLE_LOGGING:", config.ENABLE_LOGGING);
console.log("   DEBUG:", config.DEBUG);

const app = express();
const PORT = config.PORT;

// Middleware CORS com fallback
const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((origin) =>
  origin.trim()
);
console.log("🌐 Origins permitidos:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requests sem origin (como mobile apps ou curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `Origin ${origin} não permitida pelo CORS`;
        console.log("🚫 CORS bloqueado:", origin);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware (condicional)
if (config.ENABLE_LOGGING === "true") {
  app.use((req, res, next) => {
    console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (Object.keys(req.query).length > 0) {
      console.log("   Query:", req.query);
    }
    if (
      Object.keys(req.body).length > 0 &&
      req.path !== "/api/complete-search"
    ) {
      console.log(
        "   Body:",
        JSON.stringify(req.body).substring(0, 200) + "..."
      );
    }
    next();
  });
}

// Rotas
app.use("/api/token/oferta-voos", tokenRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/complete-search", completeSearchRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    port: config.PORT,
    origins: allowedOrigins,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    message: "LATAM Proxy API - Railway",
    version: "1.0.0",
    environment: config.NODE_ENV,
    endpoints: {
      token: "/api/token/oferta-voos",
      search: "/api/search",
      completeSearch: "/api/complete-search",
      health: "/health",
    },
    config: {
      port: config.PORT,
      allowedOrigins: allowedOrigins,
      logging: config.ENABLE_LOGGING,
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
    stack: config.NODE_ENV === "development" ? error.stack : undefined,
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ Rota não encontrada:", req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
    path: req.originalUrl,
  });
});

// Tratamento de erro não capturado
process.on('uncaughtException', (error) => {
    console.error('💥 ERRO NÃO CAPTURADO (uncaughtException):', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 PROMISE REJEITADA NÃO TRATADA (unhandledRejection):', reason);
    process.exit(1);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor LATAM Proxy rodando na porta ${PORT}`);
    console.log(`🌍 Ambiente: ${config.NODE_ENV}`);
    console.log(`🔗 Health check: https://latam-proxy-production.up.railway.app/health`);
    console.log(`🌐 Origins permitidos: ${allowedOrigins.join(', ')}`);
    console.log(`📊 Logging: ${config.ENABLE_LOGGING}`);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor LATAM Proxy rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${config.NODE_ENV}`);
  console.log(
    `🔗 Health check: https://latam-proxy-production.up.railway.app/health`
  );
  console.log(`🌐 Origins permitidos: ${allowedOrigins.join(", ")}`);
  console.log(`📊 Logging: ${config.ENABLE_LOGGING}`);
});
