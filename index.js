const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Proxy API",
    timestamp: new Date().toISOString(),
    version: "1.0.1",
  });
});

// NOVA ROTA: Teste direto com a página HTML
app.get("/api/test-direct", async (req, res) => {
  try {
    console.log("🔍 Testando conexão direta com Latam HTML...");

    // URL exata do seu curl
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
    console.log(
      "📋 Headers da resposta:",
      Object.fromEntries(latamResponse.headers)
    );

    if (!latamResponse.ok) {
      const errorText = await latamResponse.text();
      console.error(
        "❌ Erro Latam:",
        latamResponse.status,
        errorText.substring(0, 500)
      );

      return res.status(latamResponse.status).json({
        success: false,
        error: `Latam retornou erro ${latamResponse.status}`,
        status: latamResponse.status,
        statusText: latamResponse.statusText,
        headers: Object.fromEntries(latamResponse.headers),
        details: errorText.substring(0, 1000),
      });
    }

    // Se chegou aqui, deu 200!
    const html = await latamResponse.text();
    const hasSearchToken = html.includes("searchToken");

    console.log("✅ Conexão bem-sucedida!");
    console.log("📄 Tamanho do HTML:", html.length);
    console.log("🔑 SearchToken encontrado:", hasSearchToken);

    res.json({
      html: html,
    });

    // Extrair o token usando regex
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    res.json({
      tokenMatch: tokenMatch,
    });

    let tokenValue = null;
    if (tokenMatch && tokenMatch[1]) {
      tokenValue = tokenMatch[1];
      console.log("✅ Token encontrado:", tokenValue.substring(0, 50) + "...");
      res.json({
        token: token,
      });
    } else {
      console.log("❌ Token não encontrado no HTML");
    }

    res.json({
      success: true,
      status: latamResponse.status,
      htmlLength: html.length,
      hasSearchToken: hasSearchToken,
      headers: Object.fromEntries(latamResponse.headers),
      sample: html.substring(0, 500) + "...",
    });
  } catch (error) {
    console.error("💥 Erro no teste direto:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Rota original de busca (mantida para compatibilidade)
app.post("/api/search", async (req, res) => {
  try {
    const {
      origin = "BSB",
      destination = "GRU",
      outbound = "2025-11-17",
      inbound = "2025-11-21",
      adult = 1,
    } = req.body;

    console.log("🔍 Buscando voos via API:", {
      origin,
      destination,
      outbound,
      inbound,
    });

    // URL da API Latam
    const latamUrl = new URL(
      "https://www.latamairlines.com/bff/air-offers/v2/offers/search"
    );
    const params = {
      outFrom: outbound,
      outFlightDate: "null",
      inOfferId: "null",
      redemption: "false",
      adult: adult.toString(),
      infant: "0",
      child: "0",
      inFlightDate: "null",
      inFrom: inbound,
      origin,
      destination,
      sort: "RECOMMENDED",
      outOfferId: "null",
      cabinType: "Economy",
    };

    Object.entries(params).forEach(([key, value]) => {
      latamUrl.searchParams.set(key, value);
    });

    // Headers mais completos
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      priority: "u=1, i",
      referer: `https://www.latamairlines.com/br/pt/oferta-voos?origin=${origin}&outbound=${outbound}T00%3A00%3A00.000Z&destination=${destination}&inbound=${inbound}T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED`,
      "sec-ch-ua":
        '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "x-latam-action-name": "search-result.flightselection.offers-search",
      "x-latam-app-session-id": uuidv4(),
      "x-latam-application-country": "BR", // Mudando para BR
      "x-latam-application-lang": "pt",
      "x-latam-application-name": "web-air-offers",
      "x-latam-application-oc": "br",
      "x-latam-client-name": "web-air-offers",
      "x-latam-device-width": "1746",
      "x-latam-request-id": uuidv4(),
      "x-latam-track-id": uuidv4(),
    };

    console.log("📨 Fazendo requisição para API Latam...");
    const latamResponse = await fetch(latamUrl.toString(), {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    console.log("📊 Status da API:", latamResponse.status);

    if (!latamResponse.ok) {
      const errorText = await latamResponse.text();
      console.error("❌ Erro API Latam:", latamResponse.status, errorText);

      return res.status(latamResponse.status).json({
        success: false,
        error: `Latam API retornou erro ${latamResponse.status}`,
        details: errorText,
      });
    }

    const data = await latamResponse.json();
    console.log("✅ Dados recebidos da API");

    res.json({
      success: true,
      data: data,
      metadata: {
        origin,
        destination,
        outbound,
        inbound,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("💥 Erro no proxy:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check melhorado
app.get("/health", async (req, res) => {
  try {
    // Teste mais realista
    const testResponse = await fetch(
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&destination=GRU&adt=1",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      }
    );

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      latam_connectivity: testResponse.ok ? "connected" : "failed",
      latam_status: testResponse.status,
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Latam Proxy API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Endpoints disponíveis:`);
  console.log(`   → Health: http://localhost:${PORT}/health`);
  console.log(`   → Teste Direto: http://localhost:${PORT}/api/test-direct`);
  console.log(`   → Busca API: http://localhost:${PORT}/api/search`);
});
