const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check simples
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Token Fetcher",
    timestamp: new Date().toISOString(),
  });
});

// Rota principal: Buscar apenas o token
app.post("/api/get-token", async (req, res) => {
  try {
    console.log("🔄 Iniciando busca do searchToken...");

    // URL fixa conforme seu código
    const searchUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&outbound=2025-11-17T00%3A00%3A00.000Z&destination=GRU&inbound=2025-11-21T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&sort=RECOMMENDED";

    console.log("🔗 URL de busca:", searchUrl);

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    console.log("📨 Fazendo requisição para Latam...");

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    console.log("📊 Status da resposta:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro na requisição:", response.status, errorText);

      return res.status(500).json({
        success: false,
        error: `Erro ${response.status} na requisição`,
        details: errorText.substring(0, 500),
      });
    }

    const html = await response.text();
    console.log("📄 HTML recebido, tamanho:", html.length);

    // Extrair o token usando regex
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    if (!tokenMatch || !tokenMatch[1]) {
      console.error("❌ Token não encontrado no HTML");

      // Log para debug - mostrar trecho do HTML onde esperamos o token
      const sampleStart = html.indexOf("searchToken");
      const sample =
        sampleStart !== -1
          ? html.substring(sampleStart, sampleStart + 200)
          : "Token pattern not found";
      console.log("🔍 Amostra do HTML:", sample);

      return res.status(500).json({
        success: false,
        error: "Token não encontrado no HTML",
        sample: sample,
      });
    }

    const token = tokenMatch[1];
    console.log("✅ SearchToken obtido:", token.substring(0, 50) + "...");

    // Retornar APENAS o token como string pura
    res.send(token);
  } catch (error) {
    console.error("💥 Erro na busca do token:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Rota alternativa que retorna JSON (para testes)
app.post("/api/get-token-json", async (req, res) => {
  try {
    console.log("🔄 Buscando token (formato JSON)...");

    const searchUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&outbound=2025-11-17T00%3A00%3A00.000Z&destination=GRU&inbound=2025-11-21T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&sort=RECOMMENDED";

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    if (!tokenMatch || !tokenMatch[1]) {
      throw new Error("Token não encontrado no HTML");
    }

    const token = tokenMatch[1];
    console.log("✅ Token encontrado:", token.substring(0, 50) + "...");

    res.json({
      success: true,
      token: token,
      tokenPreview: token.substring(0, 50) + "...",
      htmlLength: html.length,
    });
  } catch (error) {
    console.error("❌ Erro:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Token Fetcher",
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Latam Token Fetcher running on port ${PORT}`);
  console.log(`📌 Endpoints:`);
  console.log(`   → GET  /health`);
  console.log(`   → POST /api/get-token      (retorna token puro)`);
  console.log(`   → POST /api/get-token-json (retorna JSON)`);
});
