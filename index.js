const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'Latam Proxy API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check detalhado
app.get('/health', async (req, res) => {
  try {
    const testResponse = await fetch('https://www.latamairlines.com', {
      timeout: 10000
    });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      latam_connectivity: testResponse.ok ? 'connected' : 'failed',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Gerar headers realistas para Latam
function generateLatamHeaders(searchParams = {}) {
  const sessionId = uuidv4();
  const requestId = uuidv4();
  const trackId = uuidv4();
  
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'priority': 'u=1, i',
    'referer': `https://www.latamairlines.com/br/pt/oferta-voos?origin=${searchParams.origin}&outbound=${searchParams.outbound}&destination=${searchParams.destination}&inbound=${searchParams.inbound}&adt=${searchParams.adult || 1}&chd=0&inf=0&trip=RT&cabin=Economy&redemption=false&sort=RECOMMENDED`,
    'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'x-latam-action-name': 'search-result.flightselection.offers-search',
    'x-latam-app-session-id': sessionId,
    'x-latam-application-country': 'ES',
    'x-latam-application-lang': 'pt',
    'x-latam-application-name': 'web-air-offers',
    'x-latam-application-oc': 'br',
    'x-latam-client-name': 'web-air-offers',
    'x-latam-device-width': '1746',
    'x-latam-request-id': requestId,
    'x-latam-track-id': trackId,
  };
}

// Gerar captcha token realista
function generateCaptchaToken() {
  const prefix = '0cAFcWeA';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = prefix;
  
  for (let i = 0; i < 3800; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return token;
}

// Rota principal de busca de voos
app.post('/api/search', async (req, res) => {
  try {
    const {
      origin,
      destination,
      outbound,
      inbound,
      adult = 1,
      child = 0,
      infant = 0,
      cabinType = 'Economy',
      sort = 'RECOMMENDED'
    } = req.body;

    // Validar parâmetros obrigatórios
    if (!origin || !destination || !outbound || !inbound) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: origin, destination, outbound, inbound'
      });
    }

    // Construir URL da Latam
    const latamUrl = new URL('https://www.latamairlines.com/bff/air-offers/v2/offers/search');
    const params = {
      outFrom: outbound,
      outFlightDate: 'null',
      inOfferId: 'null',
      redemption: 'false',
      adult: adult.toString(),
      infant: infant.toString(),
      child: child.toString(),
      inFlightDate: 'null',
      inFrom: inbound,
      origin,
      destination,
      sort,
      outOfferId: 'null',
      cabinType
    };

    // Adicionar parâmetros à URL
    Object.entries(params).forEach(([key, value]) => {
      latamUrl.searchParams.set(key, value);
    });

    // Headers para Latam
    const headers = generateLatamHeaders({ origin, destination, outbound, inbound, adult });
    headers['x-latam-captcha-token'] = generateCaptchaToken();

    console.log(`🔍 Buscando voos: ${origin} → ${destination} (${outbound} - ${inbound})`);

    // Fazer requisição para Latam
    const latamResponse = await fetch(latamUrl.toString(), {
      method: 'GET',
      headers: headers,
      timeout: 30000
    });

    // Verificar status
    if (!latamResponse.ok) {
      const errorText = await latamResponse.text();
      console.error('❌ Erro Latam:', latamResponse.status, errorText);
      
      return res.status(latamResponse.status).json({
        success: false,
        error: `Latam API retornou erro ${latamResponse.status}`,
        details: errorText.substring(0, 500)
      });
    }

    // Processar resposta
    const data = await latamResponse.json();
    
    console.log('✅ Busca realizada com sucesso');
    
    res.json({
      success: true,
      data: data,
      metadata: {
        origin,
        destination,
        outbound,
        inbound,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Erro no proxy:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      tip: 'Verifique os parâmetros e tente novamente'
    });
  }
});

// Rota de exemplo/teste
app.get('/api/test', async (req, res) => {
  try {
    const testResponse = await fetch('https://www.latamairlines.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    res.json({
      success: true,
      latam_status: testResponse.status,
      message: 'Conexão com Latam estabelecida'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    available_routes: [
      'GET  /',
      'GET  /health',
      'GET  /api/test',
      'POST /api/search'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Latam Proxy API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Endpoints:`);
  console.log(`   → Health: http://localhost:${PORT}/health`);
  console.log(`   → Search: http://localhost:${PORT}/api/search`);
});