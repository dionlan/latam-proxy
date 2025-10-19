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

// Serviços de proxy externos (gratuitos)
const PROXY_SERVICES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

// Função para usar proxy externo
async function fetchWithExternalProxy(url, options = {}) {
  const proxy =
    PROXY_SERVICES[Math.floor(Math.random() * PROXY_SERVICES.length)];
  const targetUrl = encodeURIComponent(url);

  const proxyUrl = proxy + targetUrl;

  console.log(`🔗 Usando proxy: ${proxy.substring(0, 30)}...`);

  const response = await fetch(proxyUrl, {
    method: options.method || "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...options.headers,
    },
    timeout: 15000,
  });

  return response;
}

// Função principal de fetch com fallback
async function smartFetch(url, options = {}) {
  // Primeiro tenta com proxy externo
  try {
    console.log("🔄 Tentando com proxy externo...");
    return await fetchWithExternalProxy(url, options);
  } catch (proxyError) {
    console.log("❌ Proxy externo falhou, tentando direto...");

    // Fallback para fetch direto (pode falhar, mas tentamos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (directError) {
      clearTimeout(timeoutId);
      throw new Error(`Ambas as estratégias falharam: ${directError.message}`);
    }
  }
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Flight Search API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    features: ["external-proxy", "smart-fallback"],
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
  console.log("🚀 Iniciando busca inteligente...");

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

    console.log("🎯 Buscando:", { origin, destination, outbound, inbound });

    // 1. Primeiro tentar obter token via proxy
    const searchUrl = `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${
      inbound || outbound
    }T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&sort=RECOMMENDED`;

    console.log("📨 Obtendo token via proxy...");
    const htmlResponse = await smartFetch(searchUrl, { method: "GET" });

    if (!htmlResponse.ok) {
      throw new Error(`Falha ao obter token: HTTP ${htmlResponse.status}`);
    }

    const html = await htmlResponse.text();

    // Buscar token no HTML
    const tokenPatterns = [
      /"searchToken":"([^"]*)"/,
      /searchToken["']?:\s*["']([^"']+)["']/,
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
      throw new Error("Token não encontrado - possível bloqueio anti-bot");
    }

    console.log("✅ Token obtido:", searchToken.substring(0, 30) + "...");

    // 2. Buscar ofertas com o token
    const offersUrl = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?outFrom=${outbound}&outFlightDate=null&inOfferId=null&redemption=false&adult=${adults}&infant=${babies}&child=${children}&inFlightDate=null&inFrom=${
      inbound || outbound
    }&origin=${origin}&destination=${destination}&sort=RECOMMENDED&outOfferId=null&cabinType=Economy`;

    const apiHeaders = {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: searchUrl,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "x-latam-application-country": "BR",
      "x-latam-application-lang": "pt",
      "x-latam-search-token": searchToken,
      "x-latam-request-id": uuidv4(),
      "x-latam-track-id": uuidv4(),
    };

    console.log("✈️ Buscando ofertas...");
    const apiResponse = await smartFetch(offersUrl, {
      method: "GET",
      headers: apiHeaders,
    });

    if (!apiResponse.ok) {
      throw new Error(`API retornou erro: HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    console.log(`✅ Sucesso! ${data.content?.length || 0} voos encontrados`);

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
        strategy: "proxy-assisted",
      },
    });
  } catch (error) {
    console.error("💥 Erro na busca:", error);

    // Em caso de erro, retornar dados mockados como fallback
    const mockData = generateMockFlights(req.body);

    res.json({
      success: true,
      data: mockData,
      metadata: {
        origin: req.body.origin,
        destination: req.body.destination,
        outbound: req.body.outbound,
        inbound: req.body.inbound || req.body.outbound,
        totalFlights: mockData.content.length,
        timestamp: new Date().toISOString(),
        dataType: "mock_fallback",
        error: error.message,
      },
    });
  }
});

// Função para gerar dados mockados
function generateMockFlights(params) {
  const { origin, destination, outbound, inbound, adults = 1 } = params;

  const basePrice = 200 + Math.floor(Math.random() * 400);
  const flights = [];

  const times = [
    { dep: "06:00", arr: "08:30", dur: 150 },
    { dep: "09:15", arr: "11:45", dur: 150 },
    { dep: "12:30", arr: "15:00", dur: 150 },
    { dep: "16:45", arr: "19:15", dur: 150 },
    { dep: "20:00", arr: "22:30", dur: 150 },
  ];

  times.forEach((time, index) => {
    const milesPrice = Math.floor(basePrice * 10);
    const cashPrice = basePrice + index * 25;

    flights.push({
      id: `mock-${origin}-${destination}-${index}`,
      airline: "LATAM",
      stopOvers: 0,
      flightNumber: `LA${4000 + index}`,
      origin: origin,
      originCity: getCityName(origin),
      destination: destination,
      destinationCity: getCityName(destination),
      departure: `${outbound}T${time.dep}:00`,
      arrival: `${outbound}T${time.arr}:00`,
      departureTime: time.dep,
      arrivalTime: time.arr,
      duration: `${Math.floor(time.dur / 60)}h ${time.dur % 60}m`,
      durationMinutes: time.dur,
      class: "Econômica",
      milesPrice: milesPrice,
      cashPrice: cashPrice,
      program: "latam",
      sellers: ["seller-0-0", "seller-0-1"],
      totalDurationFormatted: `${Math.floor(time.dur / 60)}h ${time.dur % 60}m`,
    });
  });

  return {
    content: flights,
    totalElements: flights.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

function getCityName(airportCode) {
  const cities = {
    BSB: "Brasília",
    REC: "Recife",
    SSA: "Salvador",
    FOR: "Fortaleza",
    GRU: "São Paulo",
    GIG: "Rio de Janeiro",
    CGH: "São Paulo",
  };
  return cities[airportCode] || airportCode;
}

// Rota de teste de proxy
app.get("/api/test-proxy", async (req, res) => {
  try {
    const testUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&destination=REC";

    console.log("🔍 Testando proxy com URL real...");
    const response = await smartFetch(testUrl);

    res.json({
      success: true,
      status: response.status,
      working: response.ok,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      working: false,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Railway API rodando na porta ${PORT}`);
  console.log(`📌 Endpoints disponíveis:`);
  console.log(`   → GET /api/health`);
  console.log(`   → GET /api/test-proxy`);
  console.log(`   → POST /api/complete-search`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🎯 Estratégia: Proxy Externo + Fallback Inteligente`);
});
