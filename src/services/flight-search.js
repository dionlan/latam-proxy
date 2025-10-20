import {
  FlightSearch,
  TokenData,
  Flight,
  LatamFlightOffer,
} from "../lib/types.js";
import { TokenManager, UrlBuilder } from "../lib/api-utils.js";
import fetch from "node-fetch";

export class FlightSearchService {
  static USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  // BUSCA DIRETA DA LATAM (Método principal no Railway)
  static async searchFlightsWithRailway(searchParams) {
    console.log("🚄 INICIANDO BUSCA DIRETA DA LATAM (Railway)");

    const { origin, destination, departureDate, returnDate, passengerDetails } =
      searchParams;

    console.log("🎯 Buscando voos:", {
      origem: origin,
      destino: destination,
      dataIda: departureDate,
      dataVolta: returnDate,
      passageiros: passengerDetails,
    });

    let tokenData = TokenManager.getToken();

    console.log("🔍 Token atual:", tokenData ? "Encontrado" : "Não encontrado");

    if (!tokenData || this.isTokenExpired(tokenData)) {
      console.log("🔄 Obtendo novo token...");
      await this.getUrlSearchToken(searchParams);
      tokenData = TokenManager.getToken();
    }

    if (!tokenData) {
      throw new Error("Não foi possível obter o token de busca");
    }

    console.log("✅ Token válido obtido");
    return await this.getFlightApiOffersWithFetch(
      searchParams,
      tokenData.searchToken
    );
  }

  // MÉTODO PARA OBTER TOKEN
  static async getUrlSearchToken(searchParams) {
    console.log("🔄 Obtendo novo searchToken...");

    const searchUrl = UrlBuilder.buildSearchUrl(searchParams);
    console.log("🔗 URL de busca para token:", searchUrl);

    const headers = {
      "User-Agent": this.USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    console.log("📋 Fazendo requisição para obter token...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("❌ Erro HTTP:", response.status, response.statusText);
        throw new Error(
          `Erro na requisição: ${response.status} ${response.statusText}`
        );
      }

      const html = await response.text();
      console.log("✅ Resposta recebida, tamanho:", html.length);

      const tokenMatch = html.match(/"searchToken":"([^"]*)"/);
      if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];
        console.log("✅ SearchToken obtido:", token.substring(0, 50) + "...");

        TokenManager.setToken(token);
        return token;
      } else {
        console.error("❌ Token não encontrado na resposta");
        throw new Error("Token não encontrado na resposta");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Timeout ao obter token (30s)");
      }
      throw error;
    }
  }

  // BUSCA DE OFERTAS COM TOKEN
  static async getFlightApiOffersWithFetch(searchParams, searchToken) {
    console.log("🔍 Buscando ofertas com fetch...");

    const offersUrl = UrlBuilder.buildApiOffersUrl(searchParams);
    const expId = this.generateUUID();
    const refererUrl = UrlBuilder.getRefererUrl(searchParams, expId);

    console.log("🔗 URL de ofertas:", offersUrl);
    console.log("🔗 Referer URL com exp_id:", refererUrl);

    const sessionId = this.generateUUID();
    const requestId = this.generateUUID();
    const trackId = this.generateUUID();

    const refererWithExpId = `${refererUrl}&exp_id=${expId}`;

    const headers = {
      authority: "www.latamairlines.com",
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      origin: "https://www.latamairlines.com",
      pragma: "no-cache",
      referer: refererWithExpId,
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
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
      "x-latam-device-width": "1920",
      "x-latam-request-id": requestId,
      "x-latam-search-token": searchToken,
      "x-latam-track-id": trackId,
      Cookie: this.generateRealisticCookies(),
    };

    console.log(
      "📋 Headers configurados:",
      Object.keys(headers).length,
      "headers"
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      console.log("📋 Fazendo requisição para ofertas...");
      const response = await fetch(offersUrl, {
        method: "GET",
        headers: headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("📊 Status da resposta:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Erro HTTP:", response.status, response.statusText);

        if (response.status === 418) {
          throw new Error(
            "Acesso bloqueado pela LATAM (Erro 418). Tente novamente mais tarde."
          );
        }

        throw new Error(
          `Erro na busca de ofertas: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.text();
      console.log("✅ Busca concluída com sucesso");
      console.log(
        "📦 Dados retornados (primeiros 500 chars):",
        data.substring(0, 500) + "..."
      );

      return this.parseOffersResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Timeout na busca de ofertas (30s)");
      }

      throw error;
    }
  }

  // COOKIES MAIS REALISTAS
  static generateRealisticCookies() {
    const cookies = [
      `_abck=${this.generateRandomString(400)}`,
      `bm_sz=${this.generateRandomString(100)}`,
      `_xp_exp_id=${this.generateUUID()}`,
      `ak_bmsc=${this.generateRandomString(200)}`,
      `bm_sv=${this.generateRandomString(200)}`,
    ].join("; ");

    return cookies;
  }

  // MÉTODOS AUXILIARES
  static generateRandomString(length) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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

  static isTokenExpired(tokenData) {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = tokenData.exp < now;
    console.log(
      "⏰ Token expirado?",
      isExpired,
      "(exp:",
      tokenData.exp,
      "now:",
      now,
      ")"
    );
    return isExpired;
  }

  static parseOffersResponse(data) {
    try {
      const parsedData = JSON.parse(data);

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
      console.error("📦 Dados que causaram erro:", data.substring(0, 500));
      return [];
    }
  }

  static transformToFlight(offer, index) {
    const summary = offer.summary;

    console.log(
      "📋 Processando voo",
      index,
      "- Summary:",
      summary ? "OK" : "N/A"
    );

    const milesPrice = summary.brands?.[0]?.price?.amount ?? 0;
    const cashPrice =
      (summary.brands?.[0]?.priceWithOutTax?.amount ?? 0) +
      (summary.brands?.[0]?.taxes?.amount ?? 0);
    const stopOvers = offer.summary.stopOvers || 0;
    const totalDurationFormatted = this.formatDuration(summary.duration);

    const departureTime =
      summary.origin.departureTime ||
      this.extractTime(summary.origin.departure || "");
    const arrivalTime =
      summary.destination.arrivalTime ||
      this.extractTime(summary.destination.arrival || "");

    const flightClass = offer.brands?.[0]?.cabin?.label || "Econômica";
    const airline = this.convertAirlineType(summary.airline || "LATAM");
    const sellers = this.generateMockSellers(index);

    const flight = new Flight({
      id: `flight-${index}-${Date.now()}`,
      airline,
      stopOvers,
      flightNumber: summary.flightCode,
      origin: summary.origin.iataCode,
      originCity: summary.origin.city,
      destination: summary.destination.iataCode,
      destinationCity: summary.destination.city,
      departure: summary.origin.departure || "",
      arrival: summary.destination.arrival || "",
      departureTime,
      arrivalTime,
      duration: totalDurationFormatted,
      durationMinutes: summary.duration,
      class: flightClass,
      milesPrice,
      cashPrice,
      program: "latam",
      sellers,
      summary: summary,
      itinerary: offer.itinerary,
      brands: offer.brands,
      totalDurationFormatted,
    });

    console.log(
      `✈️ Voo ${index} processado:`,
      flight.origin,
      "→",
      flight.destination,
      "-",
      flight.airline
    );
    return flight;
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

  static convertAirlineType(airline) {
    const upperAirline = airline.toUpperCase();
    if (upperAirline.includes("GOL")) return "GOL";
    if (upperAirline.includes("AZUL")) return "AZUL";
    return "LATAM";
  }
}
