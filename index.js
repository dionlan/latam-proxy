app.get("/api/test-direct", async (req, res) => {
  try {
    console.log("🔍 Testando conexão direta com Latam HTML...");

    // URL exata do seu curl
    const latamUrl =
      "https://www.latamairlines.com/br/pt/oferta-voos?origin=BSB&outbound=2025-11-17T00%3A00%3A00.000Z&destination=GRU&inbound=2025-11-21T00%3A00%3A00.000Z&adt=1&chd=0&inf=0&trip=RT&cabin=Economy&sort=RECOMMENDED";

    const headers = {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    console.log("📨 Fazendo requisição para:", latamUrl);

    const latamResponse = await fetch(latamUrl, {
      method: "GET",
      headers: headers,
      timeout: 30000,
    });

    console.log("📊 Status da resposta:", latamResponse.status);

    if (!latamResponse.ok) {
      const errorText = await latamResponse.text();
      console.error(
        "❌ Erro Latam:",
        latamResponse.status,
        errorText.substring(0, 500)
      );

      return res.json({
        token: null,
        error: `Latam retornou erro ${latamResponse.status}`,
      });
    }

    // Se chegou aqui, deu 200!
    const html = await latamResponse.text();

    res.json({
      html: html,
    });

    // Extrair o token usando regex
    const tokenMatch = html.match(/"searchToken":"([^"]*)"/);

    res.json({
      tokenMatch: tokenMatch,
    });

    let tokenValue = null;
    if (tokenMatch && tokenMatch[1]) {
      tokenValue = tokenMatch[1];
      console.log("✅ Token encontrado:", tokenValue.substring(0, 50) + "...");
    } else {
      console.log("❌ Token não encontrado no HTML");
    }

    // Retornar APENAS o token no formato {token: "valor"}
    res.json({
      token: tokenValue,
    });
  } catch (error) {
    console.error("💥 Erro no teste direto:", error);

    res.json({
      token: null,
      error: error.message,
    });
  }
});
