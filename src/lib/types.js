// Token interfaces
export class TokenData {
  constructor(searchToken, exp) {
    this.searchToken = searchToken;
    this.exp = exp;
  }
}

// Flight search interfaces
export class FlightSearch {
  constructor(data = {}) {
    this.origin = data.origin || "";
    this.destination = data.destination || "";
    this.departureDate = data.departureDate || "";
    this.returnDate = data.returnDate || "";
    this.tripType = data.tripType || "roundtrip";
    this.passengers = data.passengers || 1;
    this.passengerDetails = data.passengerDetails || {
      adults: 1,
      children: 0,
      babies: 0,
    };
    this.program = data.program || "all";
  }
}

export class ApiSearchParams {
  constructor(data = {}) {
    this.origin = data.origin || "";
    this.outbound = data.outbound || "";
    this.destination = data.destination || "";
    this.inbound = data.inbound || "";
    this.adt = data.adt || 1;
    this.chd = data.chd || 0;
    this.inf = data.inf || 0;
    this.trip = data.trip || "RT";
    this.cabin = data.cabin || "Economy";
    this.redemption = data.redemption || false;
    this.sort = data.sort || "DEPARTURE_DATE";
  }
}

// Flight interfaces
export class Flight {
  constructor(data = {}) {
    this.id = data.id || "";
    this.airline = data.airline || "LATAM";
    this.stopOvers = data.stopOvers || 0;
    this.flightNumber = data.flightNumber || "";
    this.origin = data.origin || "";
    this.originCity = data.originCity || "";
    this.destination = data.destination || "";
    this.destinationCity = data.destinationCity || "";
    this.departure = data.departure || "";
    this.arrival = data.arrival || "";
    this.departureTime = data.departureTime || "";
    this.arrivalTime = data.arrivalTime || "";
    this.duration = data.duration || "";
    this.durationMinutes = data.durationMinutes || 0;
    this.class = data.class || "Econômica";
    this.milesPrice = data.milesPrice || 0;
    this.cashPrice = data.cashPrice || 0;
    this.program = data.program || "latam";
    this.sellers = data.sellers || [];
    this.summary = data.summary || {};
    this.itinerary = data.itinerary || [];
    this.brands = data.brands || [];
    this.totalDurationFormatted = data.totalDurationFormatted || "";
  }
}

export class LatamApiResponse {
  constructor(data = {}) {
    this.content = data.content || [];
    this.totalElements = data.totalElements || 0;
    this.totalPages = data.totalPages || 0;
  }
}

export class LatamFlightOffer {
  constructor(data = {}) {
    this.summary = data.summary || {};
    this.itinerary = data.itinerary || [];
    this.brands = data.brands || [];
  }
}

// Request interfaces
export class RequestHeaders {
  constructor(headers = {}) {
    Object.assign(this, headers);
  }
}
