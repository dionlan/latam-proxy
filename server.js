import express from "express";
import cors from "cors";
import tokenRoutes from "./src/api/token/oferta-voos.js";
import searchRoutes from "./src/api/search/search.js";
import completeSearchRoutes from "./src/api/complete-search.js";
import helmet from 'helmet';

// Carrega variáveis de ambiente (apenas para desenvolvimento)
import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// Configurações com fallbacks robustos E tratamento de erro
const config = {
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT || 3001,
  // CORREÇÃO: Limpa e formata corretamente os origins
  ALLOWED_ORIGINS: (
    process.env.ALLOWED_ORIGINS ||
    "https://viajante-de-plantao.vercel.app,http://localhost:3000"
  )
    .replace(/'/g, "") // Remove aspas simples
    .replace(/\|\|/g, ",") // Substitui || por vírgula
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .join(","),
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

// CORREÇÃO: Processamento robusto dos origins permitidos
let allowedOrigins;
try {
  allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((origin) =>
    origin.trim()
  );
  console.log("🌐 Origins permitidos processados:", allowedOrigins);
} catch (error) {
  console.error(
    "❌ Erro ao processar ALLOWED_ORIGINS, usando fallback:",
    error
  );
  allowedOrigins = [
    "https://viajante-de-plantao.vercel.app",
    "http://localhost:3000",
  ];
}

// Middleware CORS com fallback robusto
app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requests sem origin (como mobile apps, curl, etc)
      if (!origin) {
        console.log("🔓 Request sem origin - Permitido");
        return callback(null, true);
      }

      // Verifica se o origin está na lista permitida
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        // Comparação flexível para lidar com diferentes formatos
        return (
          origin === allowedOrigin ||
          origin.replace(/\/$/, "") === allowedOrigin.replace(/\/$/, "")
        );
      });

      if (isAllowed) {
        console.log("✅ Origin permitido:", origin);
        return callback(null, true);
      } else {
        console.log("🚫 Origin bloqueado:", origin);
        console.log("📋 Origins esperados:", allowedOrigins);
        return callback(
          new Error(`Origin ${origin} não permitida pelo CORS`),
          false
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false, // Desabilita se causar problemas
    crossOriginEmbedderPolicy: false,
  })
);

// Middleware para lidar com errors CORS de forma mais amigável
app.use((err, req, res, next) => {
  if (err.message.includes("CORS")) {
    console.log("🌐 Erro CORS tratado:", err.message);
    return res.status(403).json({
      success: false,
      error: "Acesso não permitido por política CORS",
      message: err.message,
    });
  }
  next(err);
});

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
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    // Testa conectividade com serviços externos
    services: {
      railway: "OK",
      latam: "UNKNOWN", // Poderia testar conectividade
    },
  };

  res.json(health);
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
  console.error("❌ Erro não tratado:", error.message);
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor LATAM Proxy rodando na porta ${PORT}`);
  console.log(`🌍 Ambiente: ${config.NODE_ENV}`);
  console.log(
    `🔗 Health check: https://latam-proxy-production.up.railway.app/health`
  );
  console.log(`🌐 Origins permitidos: ${allowedOrigins.join(", ")}`);
  console.log(`📊 Logging: ${config.ENABLE_LOGGING}`);
});
