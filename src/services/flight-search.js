import { Flight } from '../lib/types.js';
import { TokenManager, UrlBuilder } from '../lib/api-utils.js';
import fetch from 'node-fetch';

export class FlightSearchService {
    static USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

    static async getUrlSearchToken(searchParams) {
        console.log('🔄 Obtendo novo searchToken...');

        const searchUrl = UrlBuilder.buildSearchUrl(searchParams);
        console.log('🔗 URL de busca para token:', searchUrl);

        const headers = {
            'User-Agent': this.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
        };

        console.log('📋 Fazendo requisição para obter token...');
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }

        const html = await response.text();
        console.log('✅ Resposta recebida, tamanho:', html.length);

        const tokenMatch = html.match(/"searchToken":"([^"]*)"/);
        if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            console.log('✅ SearchToken obtido:', token.substring(0, 50) + '...');

            TokenManager.setToken(token);
            return token;
        } else {
            throw new Error('Token não encontrado na resposta');
        }
    }

    static async searchFlights(searchParams) {
        console.log('✈️ Iniciando busca de voos...', searchParams);

        let tokenData = TokenManager.getToken();

        console.log('🔄 Obtendo novo token...');
        await this.getUrlSearchToken(searchParams);
        tokenData = TokenManager.getToken();

        if (!tokenData) {
            throw new Error('Não foi possível obter o token de busca');
        }

        return await this.getFlightApiOffersWithFetch(searchParams, tokenData.searchToken);
    }

    static async getFlightApiOffersWithFetch(searchParams, searchToken) {
        console.log('🔍 Buscando ofertas com fetch...');

        const offersUrl = UrlBuilder.buildApiOffersUrl(searchParams);
        const expId = this.generateUUID();
        const refererUrl = UrlBuilder.getRefererUrl(searchParams, expId);

        console.log('🔗 URL de ofertas:', offersUrl);
        console.log('🔗 Referer URL com exp_id:', refererUrl);

        const sessionId = this.generateUUID();
        const requestId = this.generateUUID();
        const trackId = this.generateUUID();

        const refererWithExpId = `${refererUrl}&exp_id=${expId}`;

        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'priority': 'u=1, i',
            'referer': refererWithExpId,
            'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'x-latam-action-name': 'search-result.flightselection.offers-search',
            'x-latam-app-session-id': sessionId,
            'x-latam-application-country': 'BR',
            'x-latam-application-lang': 'pt',
            'x-latam-application-name': 'web-air-offers',
            'x-latam-application-oc': 'br',
            'x-latam-client-name': 'web-air-offers',
            'x-latam-device-width': '1746',
            'x-latam-request-id': requestId,
            'x-latam-search-token': searchToken,
            'x-latam-track-id': trackId,
            'Cookie': this.generateCookies()
        };

        console.log('📋 Headers configurados:', Object.keys(headers).length, 'headers');

        console.log('📋 Fazendo requisição para ofertas...');
        const response = await fetch(offersUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Erro na busca de ofertas: ${response.status}`);
        }

        const data = await response.text();
        console.log('✅ Busca concluída com sucesso');
        console.log('📦 Dados retornados:', data.substring(0, 200) + '...');

        return this.parseOffersResponse(data);
    }

    static generateCookies() {
        const abck = this.generateRandomString(500);
        const xpExpId = this.generateUUID();
        const bmSz = this.generateRandomString(100);
        const xpSession = `s%3A${this.generateRandomString(50)}.${this.generateRandomString(100)}`;

        return `_abck=${abck}; _xp_exp_id=${xpExpId}; bm_sz=${bmSz}; _xp_session=${xpSession}`;
    }

    static generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~-';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static parseOffersResponse(data) {
        try {
            const parsedData = JSON.parse(data);

            console.log('📊 Resposta da API LATAM:', {
                hasContent: !!parsedData.content,
                contentCount: parsedData.content?.length || 0,
                totalElements: parsedData.totalElements,
                totalPages: parsedData.totalPages
            });

            if (parsedData.content && Array.isArray(parsedData.content)) {
                const flights = parsedData.content.map((offer, index) =>
                    this.transformToFlight(offer, index)
                );
                console.log(`✅ ${flights.length} voos transformados de content`);
                return flights;
            }

            console.warn('⚠️ Estrutura de resposta não reconhecida');
            return [];

        } catch (error) {
            console.error('❌ Erro ao parsear resposta:', error);
            console.error('📦 Dados que causaram erro:', data.substring(0, 500));
            return [];
        }
    }

    static transformToFlight(offer, index) {
        const summary = offer.summary;

        //console.log('SUMMARY:', summary);

        const milesPrice = summary.brands?.[0]?.price?.amount ?? 0;
        //console.log('MILES PRICE:', milesPrice);

        const cashPrice = (summary.brands?.[0]?.priceWithOutTax?.amount ?? 0) + (summary.brands?.[0]?.taxes?.amount ?? 0);
        //console.log('CASH PRICE:', cashPrice);

        const stopOvers = offer.summary.stopOvers || 0;
        const totalDurationFormatted = this.formatDuration(summary.duration);

        const departureTime = summary.origin.departureTime ||
            this.extractTime(summary.origin.departure || '');
        const arrivalTime = summary.destination.arrivalTime ||
            this.extractTime(summary.destination.arrival || '');

        const flightClass = offer.brands?.[0]?.cabin?.label || 'Econômica';
        const airline = this.convertAirlineType(summary.airline || 'LATAM');
        const sellers = this.generateMockSellers(index);

        return new Flight({
            id: `flight-${index}-${Date.now()}`,
            airline,
            stopOvers,
            flightNumber: summary.flightCode,
            origin: summary.origin.iataCode,
            originCity: summary.origin.city,
            destination: summary.destination.iataCode,
            destinationCity: summary.destination.city,
            departure: summary.origin.departure || '',
            arrival: summary.destination.arrival || '',
            departureTime,
            arrivalTime,
            duration: totalDurationFormatted,
            durationMinutes: summary.duration,
            class: flightClass,
            milesPrice,
            cashPrice,
            program: 'latam',
            sellers,
            summary: summary,
            itinerary: offer.itinerary,
            brands: offer.brands,
            totalDurationFormatted
        });
    }

    static extractTime(dateTimeString) {
        if (!dateTimeString) return '';
        try {
            const date = new Date(dateTimeString);
            return date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch {
            return '';
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
            "seller-0-0", "seller-0-1", "seller-1-0", "seller-2-0",
            "seller-2-1", "seller-2-2", "seller-3-0", "seller-3-1",
            "seller-4-0", "seller-4-1", "seller-4-2", "seller-4-3"
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
        if (upperAirline.includes('GOL')) return 'GOL';
        if (upperAirline.includes('AZUL')) return 'AZUL';
        return 'LATAM';
    }
}