const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  cors({
    origin: [
      "https://viajante-de-plantao.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Função com retry logic
async function fetchWithRetry(url, options, maxRetries = 3, baseDelay = 2000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${maxRetries} para: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s por tentativa

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      console.warn(
        `⚠️ Tentativa ${attempt} falhou com status: ${response.status}`
      );
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Tentativa ${attempt} falhou:`, error.message);

      if (attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Todas as ${maxRetries} tentativas falharam`);
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Flight Search API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Proxy API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// 3. ROTA COMPLETA COM RETRY LOGIC
app.post("/api/complete-search", async (req, res) => {
  let tokenAcquisitionSuccess = false;

  try {
    const {
      origin,
      destination,
      outbound,
      inbound,
      adults = 1,
      children = 0,
      babies = 0,
    } = req.body;

    console.log("🚀 Iniciando busca completa...", {
      origin,
      destination,
      outbound,
      inbound,
      adults,
      children,
      babies,
    });

    // Validar parâmetros obrigatórios
    if (!origin || !destination || !outbound) {
      return res.status(400).json({
        success: false,
        error:
          "Parâmetros obrigatórios faltando: origin, destination, outbound",
      });
    }

    // 1. Obter token diretamente com retry
    console.log("🔄 Obtendo token...");
    const searchUrl = `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${
      inbound || outbound
    }T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&sort=RECOMMENDED`;

    const htmlHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Referer: "https://www.latamairlines.com/br/pt",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    };

    console.log("📨 Buscando token na URL:", searchUrl);

    const htmlResponse = await fetchWithRetry(
      searchUrl,
      {
        method: "GET",
        headers: htmlHeaders,
      },
      3,
      2000
    );

    console.log("📊 Status da resposta do token:", htmlResponse.status);

    if (!htmlResponse.ok) {
      throw new Error(`Falha ao obter token: HTTP ${htmlResponse.status}`);
    }

    const html = await htmlResponse.text();

    // Múltiplos padrões para encontrar o token
    const tokenPatterns = [
      /"searchToken":"([^"]*)"/,
      /searchToken["']?:\s*["']([^"']+)["']/,
      /token["']?:\s*["']([^"']+)["']/,
    ];

    let searchToken = null;
    for (const pattern of tokenPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        searchToken = match[1];
        break;
      }
    }

    if (!searchToken) {
      console.error(
        "❌ Token não encontrado no HTML. Padrões testados:",
        tokenPatterns.length
      );

      // Debug: verificar se a página carregou corretamente
      const hasCaptcha =
        html.includes("captcha") ||
        html.includes("robot") ||
        html.includes("Cloudflare");
      const hasError =
        html.includes("error") ||
        html.includes("manutenção") ||
        html.includes("maintenance");

      console.log("🔍 Análise do HTML:", {
        length: html.length,
        hasCaptcha,
        hasError,
        title: html.match(/<title>(.*?)<\/title>/)?.[1] || "Não encontrado",
      });

      throw new Error(
        "Token de busca não encontrado na resposta da LATAM. Possível bloqueio."
      );
    }

    tokenAcquisitionSuccess = true;
    console.log(
      "✅ Token obtido com sucesso:",
      searchToken.substring(0, 50) + "..."
    );

    // 2. Buscar voos com o token
    console.log("✈️ Buscando voos com token...");
    const offersUrl = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?outFrom=${outbound}&outFlightDate=null&inOfferId=null&redemption=false&adult=${adults}&infant=${babies}&child=${children}&inFlightDate=null&inFrom=${
      inbound || outbound
    }&origin=${origin}&destination=${destination}&sort=RECOMMENDED&outOfferId=null&cabinType=Economy`;

    const sessionId = uuidv4();
    const requestId = uuidv4();
    const trackId = uuidv4();
    const expId = uuidv4();

    const apiHeaders = {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      priority: "u=1, i",
      referer: `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${
        inbound || outbound
      }T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED&exp_id=${expId}`,
      "sec-ch-ua":
        '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-latam-action-name": "search-result.flightselection.offers-search",
      "x-latam-app-session-id": sessionId,
      "x-latam-application-country": "BR",
      "x-latam-application-lang": "pt",
      "x-latam-application-name": "web-air-offers",
      "x-latam-application-oc": "br",
      "x-latam-client-name": "web-air-offers",
      "x-latam-device-width": "1746",
      "x-latam-request-id": requestId,
      "x-latam-search-token": searchToken,
      "x-latam-track-id": trackId,
      "Cache-Control": "no-cache",
    };

    console.log("📨 Buscando ofertas na API LATAM...");
    const apiResponse = await fetchWithRetry(
      offersUrl,
      {
        method: "GET",
        headers: apiHeaders,
      },
      2,
      1000
    );

    console.log("📊 Status da API LATAM:", apiResponse.status);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("❌ Erro na API LATAM:", apiResponse.status, errorText);
      throw new Error(`API LATAM retornou erro ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    console.log(
      "✅ Busca completa finalizada. Voos encontrados:",
      data.content?.length || 0
    );

    res.json({
      success: true,
      data: data,
      metadata: {
        origin,
        destination,
        outbound,
        inbound: inbound || outbound,
        totalFlights: data.content?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 Erro na busca completa:", error);

    const errorType =
      error.name === "AbortError"
        ? "TIMEOUT"
        : error.message.includes("network")
        ? "NETWORK_ERROR"
        : "API_ERROR";

    const errorMessage = `Erro ${errorType}: ${error.message}`;

    res.status(500).json({
      success: false,
      error: errorMessage,
      errorType,
      tokenAcquired: tokenAcquisitionSuccess,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("💥 Erro não tratado:", error);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint não encontrado",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Railway API rodando na porta ${PORT}`);
  console.log(`📌 Endpoints disponíveis:`);
  console.log(`   → GET /api/health`);
  console.log(`   → POST /api/complete-search`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
});
