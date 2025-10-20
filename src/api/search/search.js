import express from "express";
import { FlightSearchService } from "../../services/flight-search.js";
import { FlightSearch } from "../../lib/types.js";

const router = express.Router();

// Rota POST para compatibilidade com o código original
router.post("/", async (req, res) => {
  try {
    console.log("🔍 Recebida requisição POST de busca");
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

// Rota GET para busca de voos via query params
router.get("/bff/air-offers/v2/offers/search", async (req, res) => {
  try {
    console.log("🔍 Recebida requisição GET direta para ofertas");
    console.log("📋 Query params:", req.query);

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

    console.log("🎯 Parâmetros convertidos:", searchParams);

    // Usa a busca direta da LATAM
    const flights = await FlightSearchService.searchFlightsWithRailway(
      searchParams
    );

    console.log(`✅ Busca GET concluída: ${flights.length} voos encontrados`);

    // Retorna no formato esperado pela API original
    res.json({
      content: flights,
      totalElements: flights.length,
      totalPages: 1,
      success: true,
    });
  } catch (error) {
    console.error("❌ Erro na busca GET:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      content: [],
      totalElements: 0,
      totalPages: 0,
    });
  }
});

export default router;
