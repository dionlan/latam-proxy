import express from "express";
import { FlightSearchService } from "../../services/flight-search.js";
import { FlightSearch } from "../../lib/types.js";

const router = express.Router();

// Rota GET para busca completa (duas etapas)
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

    // Executa as duas etapas: token + consulta
    const flights = await FlightSearchService.searchFlightsWithRailway(
      searchParams
    );

    const endTime = Date.now();
    console.log(
      `✅ BUSCA COMPLETA CONCLUÍDA EM ${endTime - startTime}ms: ${
        flights.length
      } voos encontrados`
    );

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
      `❌ ERRO NA BUSCA COMPLETA (${endTime - startTime}ms):`,
      error.message
    );

    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes("Invalid URL")) {
      statusCode = 400;
      errorMessage = "URL inválida para busca de voos";
    } else if (
      error.message.includes("418") ||
      error.message.includes("bloqueado")
    ) {
      statusCode = 429;
      errorMessage =
        "Acesso temporariamente bloqueado. Tente novamente em alguns minutos.";
    } else if (error.message.includes("Timeout")) {
      statusCode = 504;
      errorMessage = "Tempo limite excedido na busca.";
    } else if (error.message.includes("token")) {
      statusCode = 401;
      errorMessage = "Problema com autenticação. Tente novamente.";
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

export default router;
