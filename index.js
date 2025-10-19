const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Aumenta limite para HTML grande

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam HTML Extractor",
    timestamp: new Date().toISOString(),
  });
});

// ROTA PRINCIPAL: Retorna HTML completo
app.get("/api/test-direct", async (req, res) => {
  try {
    console.log("🔍 Buscando HTML completo da Latam...");

    // URL fixa para teste
    const latamUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&outbound=2025-11-17T00%3A00%3A00.000Z&destination=GRU&inbound=2025-11-21T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&sort=RECOMMENDED";

    const headers = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    console.log("📨 Fazendo requisição para:", latamUrl);

    const latamResponse = await fetch(latamUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    console.log("📊 Status da resposta:", latamResponse.status);

    if (!latamResponse.ok) {
      const errorText = await latamResponse.text();
      console.error("❌ Erro Latam:", latamResponse.status);

      return res.status(latamResponse.status).json({
        error: `Latam retornou erro ${latamResponse.status}`,
        details: errorText.substring(0, 500),
      });
    }

    // Obter HTML completo
    const html = await latamResponse.text();

    console.log("✅ HTML obtido! Tamanho:", html.length, "caracteres");
    console.log("🔍 Procurando por searchToken...");

    // Verificar se tem token
    const hasSearchToken = html.includes("searchToken");
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);
    const token = tokenMatch ? tokenMatch[1] : null;

    console.log("🔑 SearchToken encontrado:", hasSearchToken);
    if (token) {
      console.log("✅ Token:", token.substring(0, 50) + "...");
    }

    // ✅ RETORNA APENAS ESTE JSON - HTML COMPLETO
    res.json({
      html: html,
      metadata: {
        length: html.length,
        hasSearchToken: hasSearchToken,
        token: token,
        status: latamResponse.status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 Erro:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Rota alternativa apenas para o token
app.get("/api/token", async (req, res) => {
  try {
    console.log("🔍 Extraindo apenas o token...");

    const latamUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&outbound=2025-11-17T00%3A00%3A00.000Z&destination=GRU&inbound=2025-11-21T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&sort=RECOMMENDED";

    const headers = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    };

    const latamResponse = await fetch(latamUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    if (!latamResponse.ok) {
      throw new Error(`HTTP ${latamResponse.status}`);
    }

    const html = await latamResponse.text();
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    if (tokenMatch && tokenMatch[1]) {
      const token = tokenMatch[1];
      console.log("✅ Token extraído:", token.substring(0, 50) + "...");

      res.json({
        token: token,
      });
    } else {
      throw new Error("Token não encontrado no HTML");
    }
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).json({
      token: null,
      error: error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   → GET /api/test-direct - HTML completo`);
  console.log(`   → GET /api/token - Apenas o token`);
  console.log(`   → GET /health - Health check`);
});
