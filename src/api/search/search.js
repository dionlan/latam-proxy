import express from "express";
import { FlightSearchService } from "../../services/flight-search.js";
import { FlightSearch } from "../../lib/types.js";

const router = express.Router();

// Rota GET direta para ofertas (que está retornando 502)
router.get("/bff/air-offers/v2/offers/search", async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("🔍 RECEBIDA REQUISIÇÃO GET PARA OFERTAS");
    console.log("📋 Query params:", req.query);

    // Validação básica
    if (!req.query.origin || !req.query.destination || !req.query.outFrom) {
      return res.status(400).json({
        success: false,
        error: "Parâmetros obrigatórios faltando: origin, destination, outFrom",
      });
    }

    const searchParams = new FlightSearch({
      origin: req.query.origin,
      destination: req.query.destination,
      departureDate: req.query.outFrom,
      returnDate: req.query.inFrom !== "null" ? req.query.inFrom : undefined,
      tripType: req.query.inFrom !== "null" ? "roundtrip" : "oneway",
      passengerDetails: {
        adults: parseInt(req.query.adult) || 1,
        children: parseInt(req.query.child) || 0,
        babies: parseInt(req.query.infant) || 0,
      },
    });

    console.log(
      "🎯 Parâmetros convertidos:",
      JSON.stringify(searchParams, null, 2)
    );

    // Usa a busca direta da LATAM
    const flights = await FlightSearchService.searchFlightsWithRailway(
      searchParams
    );

    const endTime = Date.now();
    console.log(
      `✅ BUSCA GET CONCLUÍDA EM ${endTime - startTime}ms: ${
        flights.length
      } voos encontrados`
    );

    // Retorna no formato esperado pela API original
    res.json({
      content: flights,
      totalElements: flights.length,
      totalPages: 1,
      success: true,
      searchTime: endTime - startTime,
    });
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `❌ ERRO NA BUSCA GET (${endTime - startTime}ms):`,
      error.message
    );

    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes("418") || error.message.includes("bloqueado")) {
      statusCode = 429;
      errorMessage =
        "Acesso temporariamente bloqueado. Tente novamente em alguns minutos.";
    } else if (error.message.includes("Timeout")) {
      statusCode = 504;
      errorMessage = "Tempo limite excedido na busca.";
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      content: [],
      totalElements: 0,
      totalPages: 0,
      searchTime: endTime - startTime,
    });
  }
});

// Rota POST para compatibilidade
router.post("/", async (req, res) => {
  try {
    console.log("📨 Recebida requisição POST de busca");
    const {
      url,
      headers = {},
      method = "GET",
      useFetch = false,
      extractToken = false,
    } = req.body;

    console.log("📋 Detalhes da requisição:", {
      url,
      method,
      useFetch,
      extractToken,
    });

    if (useFetch) {
      const response = await fetch(url, {
        method: method,
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data = await response.text();

      if (extractToken) {
        console.log("🔍 Extraindo token da resposta...");
        const tokenMatch = data.match(/"searchToken":"([^"]*)"/);
        if (tokenMatch && tokenMatch[1]) {
          data = tokenMatch[1];
          console.log("✅ Token extraído:", data.substring(0, 50) + "...");
        } else {
          throw new Error("Token não encontrado na resposta");
        }
      }

      res.json({
        success: true,
        data: data,
        error: null,
      });
    } else {
      throw new Error("Apenas useFetch=true é suportado");
    }
  } catch (error) {
    console.error("❌ Erro na requisição POST:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null,
    });
  }
});

export default router;
