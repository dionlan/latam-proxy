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

// Lista de User-Agents rotativos
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
];

// Função para gerar headers realistas
function generateRealisticHeaders(strategy = "desktop") {
  const randomUserAgent =
    USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  const baseHeaders = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": randomUserAgent,
  };

  if (strategy === "api") {
    return {
      ...baseHeaders,
      Accept: "application/json, text/plain, */*",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
    };
  }

  return baseHeaders;
}

// Função de fetch com timeout customizável
async function robustFetch(url, options = {}, timeout = 25000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...generateRealisticHeaders(),
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Estratégia alternativa: Buscar via API direta sem token
async function tryDirectApiSearch(params) {
  console.log("🔄 Tentando busca direta via API...");

  const { origin, destination, outbound, inbound, adults, children, babies } =
    params;

  const apiUrl = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?outFrom=${outbound}&outFlightDate=null&inOfferId=null&redemption=false&adult=${adults}&infant=${babies}&child=${children}&inFlightDate=null&inFrom=${inbound}&origin=${origin}&destination=${destination}&sort=RECOMMENDED&outOfferId=null&cabinType=Economy`;

  const headers = {
    ...generateRealisticHeaders("api"),
    "x-latam-application-country": "BR",
    "x-latam-application-lang": "pt",
    "x-latam-application-name": "web-air-offers",
    "x-latam-application-oc": "br",
    "x-latam-client-name": "web-air-offers",
    "x-latam-request-id": uuidv4(),
    "x-latam-track-id": uuidv4(),
    "x-latam-app-session-id": uuidv4(),
  };

  try {
    const response = await robustFetch(
      apiUrl,
      {
        method: "GET",
        headers,
      },
      15000
    );

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Busca direta bem-sucedida!");
      return { success: true, data };
    }

    console.log(`⚠️ Busca direta falhou com status: ${response.status}`);
    return { success: false, error: `HTTP ${response.status}` };
  } catch (error) {
    console.log(`⚠️ Busca direta falhou: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Estratégia principal com fallback
async function searchWithFallback(params) {
  console.log("🎯 Iniciando estratégia de busca com fallbacks...");

  // Tentativa 1: Busca direta via API (mais rápida)
  const directResult = await tryDirectApiSearch(params);
  if (directResult.success) {
    return directResult;
  }

  // Tentativa 2: Método tradicional com token (se a direta falhar)
  console.log("🔄 Método direto falhou, tentando método com token...");
  try {
    const tokenResult = await getTokenAndSearch(params);
    return { success: true, data: tokenResult };
  } catch (error) {
    console.log("❌ Método com token também falhou:", error.message);
    return {
      success: false,
      error: `Ambas as estratégias falharam: ${error.message}`,
    };
  }
}

// Função para obter token e buscar (método tradicional)
async function getTokenAndSearch(params) {
  const { origin, destination, outbound, inbound, adults, children, babies } =
    params;

  const searchUrl = `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${inbound}T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&sort=RECOMMENDED`;

  console.log("📨 Buscando token...");
  const htmlResponse = await robustFetch(searchUrl, { method: "GET" }, 20000);

  if (!htmlResponse.ok) {
    throw new Error(`Falha ao obter token: HTTP ${htmlResponse.status}`);
  }

  const html = await htmlResponse.text();

  // Padrões para token
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
    throw new Error("Token não encontrado na resposta");
  }

  console.log("✅ Token obtido:", searchToken.substring(0, 30) + "...");

  // Buscar voos com o token
  const offersUrl = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?outFrom=${outbound}&outFlightDate=null&inOfferId=null&redemption=false&adult=${adults}&infant=${babies}&child=${children}&inFlightDate=null&inFrom=${inbound}&origin=${origin}&destination=${destination}&sort=RECOMMENDED&outOfferId=null&cabinType=Economy`;

  const apiHeaders = {
    ...generateRealisticHeaders("api"),
    "x-latam-action-name": "search-result.flightselection.offers-search",
    "x-latam-app-session-id": uuidv4(),
    "x-latam-application-country": "BR",
    "x-latam-application-lang": "pt",
    "x-latam-application-name": "web-air-offers",
    "x-latam-application-oc": "br",
    "x-latam-client-name": "web-air-offers",
    "x-latam-device-width": "1746",
    "x-latam-request-id": uuidv4(),
    "x-latam-search-token": searchToken,
    "x-latam-track-id": uuidv4(),
  };

  console.log("✈️ Buscando voos com token...");
  const apiResponse = await robustFetch(
    offersUrl,
    {
      method: "GET",
      headers: apiHeaders,
    },
    15000
  );

  if (!apiResponse.ok) {
    throw new Error(`API retornou erro: HTTP ${apiResponse.status}`);
  }

  return await apiResponse.json();
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Flight Search API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    strategies: ["direct-api", "token-based"],
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Proxy API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Rota principal otimizada
app.post("/api/complete-search", async (req, res) => {
  console.log("🚀 Recebida requisição de busca...");

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

    // Validação
    if (!origin || !destination || !outbound) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros obrigatórios: origin, destination, outbound",
      });
    }

    console.log("🎯 Parâmetros:", { origin, destination, outbound, inbound });

    const searchParams = {
      origin,
      destination,
      outbound,
      inbound: inbound || outbound,
      adults,
      children,
      babies,
    };

    // Usar estratégia com fallback
    const result = await searchWithFallback(searchParams);

    if (result.success) {
      console.log("✅ Busca finalizada com sucesso!");

      res.json({
        success: true,
        data: result.data,
        metadata: {
          origin,
          destination,
          outbound,
          inbound: inbound || outbound,
          totalFlights: result.data.content?.length || 0,
          timestamp: new Date().toISOString(),
          strategy: result.strategy || "hybrid",
        },
      });
    } else {
      console.error("❌ Todas as estratégias falharam:", result.error);

      res.status(500).json({
        success: false,
        error: result.error,
        suggestion:
          "Tente novamente em alguns instantes ou verifique os parâmetros",
      });
    }
  } catch (error) {
    console.error("💥 Erro inesperado:", error);

    res.status(500).json({
      success: false,
      error: `Erro interno: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
  }
});

// Rota de teste para verificar conectividade
app.get("/api/test-connectivity", async (req, res) => {
  try {
    console.log("🔍 Testando conectividade com LATAM...");

    const testUrl = "https://www.latamairlines.com/br/pt";
    const response = await robustFetch(testUrl, { method: "GET" }, 10000);

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      accessible: response.ok,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      accessible: false,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error("💥 Erro não tratado:", error);
  res.status(500).json({
    success: false,
    error: "Erro interno do servidor",
  });
});

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
  console.log(`   → GET /api/test-connectivity`);
  console.log(`   → POST /api/complete-search`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🎯 Estratégias: Busca direta + Token-based com fallback`);
});
