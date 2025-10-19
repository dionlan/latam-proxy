const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Flight Search API",
    timestamp: new Date().toISOString(),
  });
});

// 1. ROTA PARA OBTER TOKEN
app.post("/api/get-token", async (req, res) => {
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

    console.log("🔄 Obtendo token para:", {
      origin,
      destination,
      outbound,
      inbound,
    });

    // Construir URL da página HTML
    const searchUrl = `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${inbound}T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&sort=RECOMMENDED`;

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

    console.log("📨 Buscando HTML para extrair token...");
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${await response.text()}`);
    }

    const html = await response.text();
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    if (!tokenMatch || !tokenMatch[1]) {
      throw new Error("Token não encontrado no HTML");
    }

    const token = tokenMatch[1];
    console.log("✅ Token obtido:", token.substring(0, 50) + "...");

    res.json({
      success: true,
      token: token,
    });
  } catch (error) {
    console.error("❌ Erro ao obter token:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 2. ROTA PARA BUSCAR VOOS COM TOKEN
app.post("/api/search-flights", async (req, res) => {
  try {
    const {
      origin,
      destination,
      outbound,
      inbound,
      adults = 1,
      children = 0,
      babies = 0,
      searchToken,
    } = req.body;

    console.log("✈️ Buscando voos com token...", {
      origin,
      destination,
      outbound,
      inbound,
    });

    if (!searchToken) {
      throw new Error("Token de busca é obrigatório");
    }

    // Construir URL da API Latam
    const offersUrl = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?outFrom=${outbound}&outFlightDate=null&inOfferId=null&redemption=false&adult=${adults}&infant=${babies}&child=${children}&inFlightDate=null&inFrom=${inbound}&origin=${origin}&destination=${destination}&sort=RECOMMENDED&outOfferId=null&cabinType=Economy`;

    const sessionId = uuidv4();
    const requestId = uuidv4();
    const trackId = uuidv4();
    const expId = uuidv4();

    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      priority: "u=1, i",
      referer: `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00:00:00.000Z&destination=${destination}&inbound=${inbound}T00:00:00.000Z&adt=${adults}&chd=${children}&inf=${babies}&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED&exp_id=${expId}`,
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

    console.log("📨 Buscando ofertas na API Latam...");
    const response = await fetch(offersUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    console.log("📊 Status da API:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro na API:", response.status, errorText);
      throw new Error(`API Latam retornou erro ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Voos encontrados:", data.content?.length || 0);

    res.json({
      success: true,
      data: data,
      metadata: {
        origin,
        destination,
        outbound,
        inbound,
        totalFlights: data.content?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 Erro na busca de voos:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null,
    });
  }
});

// 3. ROTA COMPLETA (TOKEN + BUSCA)
app.post("/api/complete-search", async (req, res) => {
  try {
    const searchParams = req.body;
    console.log("🚀 Iniciando busca completa...", searchParams);

    // 1. Obter token
    const tokenResponse = await fetch(
      `http://localhost:${PORT}/api/get-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchParams),
      }
    );

    const tokenResult = await tokenResponse.json();

    if (!tokenResult.success) {
      throw new Error(`Falha ao obter token: ${tokenResult.error}`);
    }

    // 2. Buscar voos com o token
    const flightsResponse = await fetch(
      `http://localhost:${PORT}/api/search-flights`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...searchParams,
          searchToken: tokenResult.token,
        }),
      }
    );

    const flightsResult = await flightsResponse.json();

    res.json(flightsResult);
  } catch (error) {
    console.error("💥 Erro na busca completa:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Railway API rodando na porta ${PORT}`);
  console.log(`📌 Endpoints:`);
  console.log(`   → POST /api/get-token`);
  console.log(`   → POST /api/search-flights`);
  console.log(`   → POST /api/complete-search`);
});
