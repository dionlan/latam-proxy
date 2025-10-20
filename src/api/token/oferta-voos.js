import express from "express";
import { FlightSearchService } from "../../services/flight-search.js";
import { FlightSearch } from "../../lib/types.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    console.log("🔄 Recebida requisição para obter token");
    console.log("📋 Query params:", req.query);

    const searchParams = new FlightSearch({
      origin: req.query.origin,
      destination: req.query.destination,
      departureDate: req.query.outbound?.split("T")[0],
      returnDate: req.query.inbound?.split("T")[0],
      tripType: req.query.trip === "RT" ? "roundtrip" : "oneway",
      passengerDetails: {
        adults: parseInt(req.query.adt) || 1,
        children: parseInt(req.query.chd) || 0,
        babies: parseInt(req.query.inf) || 0,
      },
    });

    const token = await FlightSearchService.getUrlSearchToken(searchParams);

    res.json({
      success: true,
      token: token,
      expiresIn: 3500,
      error: null,
    });
  } catch (error) {
    console.error("❌ Erro ao obter token:", error);
    res.status(500).json({
      success: false,
      token: null,
      error: error.message,
    });
  }
});

export default router;
