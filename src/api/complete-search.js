import express from "express";
import { FlightSearchService } from "../services/flight-search.js";
import { FlightSearch } from "../lib/types.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("🚀 RECEBIDA REQUISIÇÃO DE BUSCA COMPLETA");
    console.log("📋 Headers:", req.headers);
    console.log("📦 Body completo:", JSON.stringify(req.body, null, 2));

    const { origin, destination, outbound, inbound, adults, children, babies } =
      req.body;

    // Validação dos parâmetros obrigatórios
    if (!origin || !destination || !outbound) {
      console.error("❌ Parâmetros obrigatórios faltando");
      return res.status(400).json({
        success: false,
        error:
          "Parâmetros obrigatórios faltando: origin, destination, outbound",
      });
    }

    console.log("✅ Parâmetros validados:", {
      origin,
      destination,
      outbound,
      inbound,
      adults,
      children,
      babies,
    });

    const searchParams = new FlightSearch({
      origin: `${origin} (${origin})`,
      destination: `${destination} (${destination})`,
      departureDate: outbound.split("T")[0],
      returnDate:
        inbound && inbound !== outbound ? inbound.split("T")[0] : undefined,
      tripType: inbound && inbound !== outbound ? "roundtrip" : "oneway",
      passengerDetails: {
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
        babies: parseInt(babies) || 0,
      },
    });

    console.log(
      "🎯 Iniciando busca com parâmetros:",
      JSON.stringify(searchParams, null, 2)
    );

    // Usa o método que já inclui fallback
    const flights = await FlightSearchService.searchFlightsWithRailway(
      searchParams
    );

    const endTime = Date.now();
    console.log(
      `✅ BUSCA CONCLUÍDA EM ${endTime - startTime}ms: ${
        flights.length
      } voos encontrados`
    );

    res.json({
      success: true,
      data: {
        content: flights,
        totalElements: flights.length,
        totalPages: 1,
        searchTime: endTime - startTime,
      },
      error: null,
    });
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `❌ ERRO NA BUSCA COMPLETA (${endTime - startTime}ms):`,
      error
    );

    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
      searchTime: endTime - startTime,
    });
  }
});

export default router;
