import { TokenData, ApiSearchParams } from "./types.js";

// Storage em memória para o servidor
const tokenStorage = new Map();

export class TokenManager {
  static TOKEN_KEY = 'latam_search_token';

    static getToken() {
        if (typeof window === 'undefined') {
            return tokenStorage.get(this.TOKEN_KEY) || null;
        } else {
            const tokenStr = localStorage.getItem(this.TOKEN_KEY);
            return tokenStr ? JSON.parse(tokenStr) : null;
        }
    }

  static setToken(token) {
    const tokenData = new TokenData(
      token,
      Math.floor(Date.now() / 1000) + 3500 // 58 minutos
    );

    if (typeof window === 'undefined') {
        tokenStorage.set(this.TOKEN_KEY, tokenData);
    } else {
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
    }

    console.log(
      "✅ Token salvo, expira em:",
      new Date(tokenData.exp * 1000).toISOString()
    );
  }

  static isTokenExpired(tokenData) {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = tokenData.exp < now;
    console.log("⏰ Token expirado?", isExpired);
    return isExpired;
  }

  static clearToken() {
    if (typeof window === 'undefined') {
        tokenStorage.delete(this.TOKEN_KEY);
    } else {
        localStorage.removeItem(this.TOKEN_KEY);
    }
    console.log("🗑️ Token limpo");
  }
}

export class UrlBuilder {
  static buildSearchUrl(searchParams) {
    const params = this.buildUrlParams(searchParams);

    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== "null") {
          acc[key] = value.toString();
        }
        return acc;
      }, {})
    ).toString();

    const url = `https://www.latamairlines.com/br/pt/oferta-voos?${queryString}`;
    console.log("🔗 URL de busca construída:", url);
    return url;
  }

  static buildUrlParams(searchParams) {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      tripType,
      passengerDetails,
    } = searchParams;

    const extractCode = (location) => {
      if (!location) return "";
      const match = location.match(/\(([A-Z]{3})\)/);
      return match
        ? match[1]
        : /^[A-Z]{3}$/.test(location)
        ? location
        : location.slice(-3);
    };

    const originCode = extractCode(origin);
    const destinationCode = extractCode(destination);

    if (!originCode || !destinationCode) {
      throw new Error("Códigos de aeroporto inválidos");
    }

    const params = new ApiSearchParams({
      origin: originCode,
      outbound: `${departureDate}T15:00:00.000Z`,
      destination: destinationCode,
      adt: passengerDetails.adults,
      chd: passengerDetails.children,
      inf: passengerDetails.babies,
      trip: tripType === "roundtrip" ? "RT" : "OW",
      cabin: "Economy",
      redemption: false,
      sort: "RECOMMENDED",
    });

    if (tripType === "roundtrip" && returnDate) {
      params.inbound = `${returnDate}T15:00:00.000Z`;
    }

    console.log("📋 Parâmetros construídos:", params);
    return params;
  }

  static buildApiOffersUrl(searchParams) {
    const {
      origin,
      destination,
      departureDate,
      returnDate,
      tripType,
      passengerDetails,
    } = searchParams;

    const extractCode = (location) => {
      if (!location) return "";
      const match = location.match(/\(([A-Z]{3})\)/);
      return match
        ? match[1]
        : /^[A-Z]{3}$/.test(location)
        ? location
        : location.slice(-3);
    };

    const originCode = extractCode(origin);
    const destinationCode = extractCode(destination);

    const params = {
      inOfferId: "null",
      origin: originCode,
      outFrom: departureDate,
      inFlightDate: "null",
      outFlightDate: "null",
      adult: passengerDetails.adults || 1,
      redemption: "true",
      outOfferId: "null",
      infant: passengerDetails.babies || 0,
      inFrom: tripType === "roundtrip" && returnDate ? returnDate : "null",
      sort: "RECOMMENDED",
      cabinType: "Economy",
      child: passengerDetails.children || 0,
      destination: destinationCode,
    };

    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] =
          value !== undefined && value !== null ? value.toString() : "null";
        return acc;
      }, {})
    ).toString();

    const url = `https://www.latamairlines.com/bff/air-offers/v2/offers/search?${queryString}`;
    console.log("🔗 URL de ofertas construída:", url);
    return url;
  }

  static getRefererUrl(searchParams, expId) {
    const baseUrl = this.buildSearchUrl(searchParams);
    const url = expId ? `${baseUrl}&exp_id=${expId}` : baseUrl;
    console.log("🔗 Referer URL:", url);
    return url;
  }
}
