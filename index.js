const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Simulação das interfaces TypeScript
class UrlBuilder {
  static buildSearchUrl(searchParams) {
    const {
      origin,
      destination,
      outbound,
      inbound,
      adults = 1,
      children = 0,
      infants = 0,
    } = searchParams;

    const params = new URLSearchParams({
      origin: origin || "BSB",
      outbound: `${outbound || "2025-11-17"}T00:00:00.000Z`,
      destination: destination || "GRU",
      inbound: `${inbound || "2025-11-21"}T00:00:00.000Z`,
      adt: adults.toString(),
      chd: children.toString(),
      inf: infants.toString(),
      trip: "RT",
      cabin: "Economy",
      sort: "RECOMMENDED",
    });

    return `https://www.latamairlines.com/br/pt/oferta-voos?${params.toString()}`;
  }

  static buildApiOffersUrl(searchParams) {
    const {
      origin,
      destination,
      outbound,
      inbound,
      adults = 1,
      children = 0,
      infants = 0,
    } = searchParams;

    const params = new URLSearchParams({
      outFrom: outbound || "2025-11-17",
      outFlightDate: "null",
      inOfferId: "null",
      redemption: "false",
      adult: adults.toString(),
      infant: infants.toString(),
      child: children.toString(),
      inFlightDate: "null",
      inFrom: inbound || "2025-11-21",
      origin: origin || "BSB",
      destination: destination || "GRU",
      sort: "RECOMMENDED",
      outOfferId: "null",
      cabinType: "Economy",
    });

    return `https://www.latamairlines.com/bff/air-offers/v2/offers/search?${params.toString()}`;
  }

  static getRefererUrl(searchParams, expId) {
    const { origin, destination, outbound, inbound, adults = 1 } = searchParams;

    const params = new URLSearchParams({
      origin: origin || "BSB",
      outbound: `${outbound || "2025-11-17"}T00:00:00.000Z`,
      destination: destination || "GRU",
      inbound: `${inbound || "2025-11-21"}T00:00:00.000Z`,
      adt: adults.toString(),
      chd: "0",
      inf: "0",
      trip: "RT",
      cabin: "Economy",
      redemption: "false",
      sort: "RECOMMENDED",
    });

    return `https://www.latamairlines.com/br/pt/oferta-voos?${params.toString()}`;
  }
}

class TokenManager {
  static token = null;

  static setToken(token) {
    this.token = {
      searchToken: token,
      timestamp: Date.now(),
    };
    console.log("✅ Token salvo no TokenManager");
  }

  static getToken() {
    return this.token;
  }

  static clearToken() {
    this.token = null;
    console.log("🧹 Token limpo do TokenManager");
  }
}

class FlightSearchService {
  static USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  static async getUrlSearchToken(searchParams) {
    console.log("🔄 Obtendo novo searchToken...");

    const searchUrl = UrlBuilder.buildSearchUrl(searchParams);
    console.log("🔗 URL de busca para token:", searchUrl);

    const headers = {
      "User-Agent": this.USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    try {
      console.log("📨 Fazendo requisição para Latam HTML...");
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: headers,
        timeout: 30000,
      });

      console.log("📊 Status da resposta:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ Erro na requisição do token:",
          response.status,
          errorText
        );
        throw new Error(
          `Erro na requisição: ${response.status} - ${errorText}`
        );
      }

      const html = await response.text();
      const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

      if (!tokenMatch || !tokenMatch[1]) {
        throw new Error("Token não encontrado no HTML");
      }

      const token = tokenMatch[1];
      console.log("✅ SearchToken obtido:", token.substring(0, 50) + "...");

      TokenManager.setToken(token);
      return token;
    } catch (error) {
      console.error("💥 Erro ao obter token:", error);
      throw error;
    }
  }

  static generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  static formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  static extractTime(dateTimeString) {
    if (!dateTimeString) return "";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  }

  static convertAirlineType(airline) {
    const upperAirline = (airline || "").toUpperCase();
    if (upperAirline.includes("GOL")) return "GOL";
    if (upperAirline.includes("AZUL")) return "AZUL";
    return "LATAM";
  }

  static generateMockSellers(flightIndex) {
    const availableSellerIds = [
      "seller-0-0",
      "seller-0-1",
      "seller-1-0",
      "seller-2-0",
      "seller-2-1",
      "seller-2-2",
      "seller-3-0",
      "seller-3-1",
      "seller-4-0",
      "seller-4-1",
      "seller-4-2",
      "seller-4-3",
    ];

    const sellerCounts = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3];
    const count = sellerCounts[flightIndex % sellerCounts.length] || 1;

    const selectedSellers = [];
    for (let i = 0; i < count && i < availableSellerIds.length; i++) {
      const sellerIndex = (flightIndex + i) % availableSellerIds.length;
      const sellerId = availableSellerIds[sellerIndex];
      if (!selectedSellers.includes(sellerId)) {
        selectedSellers.push(sellerId);
      }
    }

    if (selectedSellers.length === 0 && availableSellerIds.length > 0) {
      selectedSellers.push(availableSellerIds[0]);
    }

    return selectedSellers;
  }

  static transformToFlight(offer, index) {
    const summary = offer.summary || {};

    const milesPrice = summary.brands?.[0]?.price?.amount ?? 0;
    const cashPrice =
      (summary.brands?.[0]?.priceWithOutTax?.amount ?? 0) +
      (summary.brands?.[0]?.taxes?.amount ?? 0);
    const stopOvers = summary.stopOvers || 0;
    const totalDurationFormatted = this.formatDuration(summary.duration || 0);

    const departureTime =
      summary.origin?.departureTime ||
      this.extractTime(summary.origin?.departure || "");
    const arrivalTime =
      summary.destination?.arrivalTime ||
      this.extractTime(summary.destination?.arrival || "");

    const flightClass = offer.brands?.[0]?.cabin?.label || "Econômica";
    const airline = this.convertAirlineType(summary.airline || "LATAM");
    const sellers = this.generateMockSellers(index);

    return {
      id: `flight-${index}-${Date.now()}`,
      airline,
      stopOvers,
      flightNumber: summary.flightCode,
      origin: summary.origin?.iataCode,
      originCity: summary.origin?.city,
      destination: summary.destination?.iataCode,
      destinationCity: summary.destination?.city,
      departure: summary.origin?.departure || "",
      arrival: summary.destination?.arrival || "",
      departureTime,
      arrivalTime,
      duration: totalDurationFormatted,
      durationMinutes: summary.duration || 0,
      class: flightClass,
      milesPrice,
      cashPrice,
      program: "latam",
      sellers,
      summary: summary,
      itinerary: offer.itinerary,
      brands: offer.brands,
      totalDurationFormatted,
    };
  }

  static parseOffersResponse(data) {
    try {
      const parsedData = typeof data === "string" ? JSON.parse(data) : data;

      console.log("📊 Resposta da API LATAM:", {
        hasContent: !!parsedData.content,
        contentCount: parsedData.content?.length || 0,
        totalElements: parsedData.totalElements,
        totalPages: parsedData.totalPages,
      });

      if (parsedData.content && Array.isArray(parsedData.content)) {
        const flights = parsedData.content.map((offer, index) =>
          this.transformToFlight(offer, index)
        );
        console.log(`✅ ${flights.length} voos transformados de content`);
        return flights;
      }

      console.warn("⚠️ Estrutura de resposta não reconhecida");
      return [];
    } catch (error) {
      console.error("❌ Erro ao parsear resposta:", error);
      console.error(
        "📦 Dados que causaram erro:",
        typeof data === "string" ? data.substring(0, 500) : "Non-string data"
      );
      return [];
    }
  }

  static async getFlightApiOffersWithFetch(searchParams, searchToken) {
    console.log("🔍 Buscando ofertas com fetch...");

    const offersUrl = UrlBuilder.buildApiOffersUrl(searchParams);
    const expId = this.generateUUID();
    const refererUrl = UrlBuilder.getRefererUrl(searchParams, expId);

    console.log("🔗 URL de ofertas:", offersUrl);

    const sessionId = this.generateUUID();
    const requestId = this.generateUUID();
    const trackId = this.generateUUID();

    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      priority: "u=1, i",
      referer: `${refererUrl}&exp_id=${expId}`,
      "sec-ch-ua":
        '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": this.USER_AGENT,
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

    console.log(
      "📋 Headers configurados:",
      Object.keys(headers).length,
      "headers"
    );

    try {
      const response = await fetch(offersUrl, {
        method: "GET",
        headers: headers,
        timeout: 30000,
      });

      console.log("📊 Status da API:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "❌ Erro na busca de ofertas:",
          response.status,
          errorText
        );

        if (response.status === 400 || response.status === 403) {
          console.log("🔄 Possível problema com token, tentando renovar...");
          TokenManager.clearToken();
          throw new Error("TOKEN_EXPIRED");
        }

        throw new Error(
          `Erro na busca de ofertas: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("✅ Busca concluída com sucesso");

      return this.parseOffersResponse(data);
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        throw error;
      }
      console.error("💥 Erro na requisição de ofertas:", error);
      throw error;
    }
  }

  static async searchFlights(searchParams) {
    console.log("✈️ Iniciando busca de voos...", searchParams);

    try {
      // Sempre obtém novo token para garantir frescor
      await this.getUrlSearchToken(searchParams);
      const tokenData = TokenManager.getToken();

      if (!tokenData) {
        throw new Error("Não foi possível obter o token de busca");
      }

      return await this.getFlightApiOffersWithFetch(
        searchParams,
        tokenData.searchToken
      );
    } catch (error) {
      if (error.message === "TOKEN_EXPIRED") {
        console.log("🔄 Token expirado, tentando novamente...");
        TokenManager.clearToken();
        return this.searchFlights(searchParams);
      }
      throw error;
    }
  }
}

// Rotas da API
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Latam Flight Search API",
    timestamp: new Date().toISOString(),
    endpoints: {
      "/health": "GET - Health check",
      "/api/token": "POST - Get search token",
      "/api/search": "POST - Search flights",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Flight Search API",
    timestamp: new Date().toISOString(),
  });
});

// Rota para obter apenas o token
app.post("/api/token", async (req, res) => {
  try {
    const searchParams = req.body || {
      origin: "BSB",
      destination: "GRU",
      outbound: "2025-11-17",
      inbound: "2025-11-21",
      adults: 1,
    };

    console.log("🔄 Solicitando token...");
    const token = await FlightSearchService.getUrlSearchToken(searchParams);

    // Retorna APENAS o token no formato solicitado
    res.json({
      token: token,
    });
  } catch (error) {
    console.error("❌ Erro ao obter token:", error);
    res.status(500).json({
      token: null,
      error: error.message,
    });
  }
});

// Rota completa de busca
app.post("/api/search", async (req, res) => {
  try {
    const searchParams = req.body || {
      origin: "BSB",
      destination: "GRU",
      outbound: "2025-11-17",
      inbound: "2025-11-21",
      adults: 1,
      children: 0,
      infants: 0,
    };

    console.log("✈️ Iniciando busca completa...");
    const flights = await FlightSearchService.searchFlights(searchParams);

    res.json({
      success: true,
      data: flights,
      count: flights.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("💥 Erro na busca completa:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: [],
    });
  }
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Latam Flight Search API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Endpoints disponíveis:`);
  console.log(`   → GET  /health`);
  console.log(`   → POST /api/token  (retorna {token: "valor"})`);
  console.log(`   → POST /api/search (busca completa)`);
});
