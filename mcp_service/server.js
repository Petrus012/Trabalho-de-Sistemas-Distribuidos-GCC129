const express = require('express');
const axios   = require('axios');
const app     = express();
app.use(express.json());

const PORT        = 8002;
const RAG_URL     = 'http://127.0.0.1:8001';

// ---------------------------------------------------------------------------
// Utilitário — chama o RAG e retorna o texto da resposta
// ---------------------------------------------------------------------------
async function consultarRAG(query) {
    const resposta = await axios.post(`${RAG_URL}/mcp/tools/call`, {
        tool:      "consultar_documentos_aula",
        arguments: { query }
    });
    return resposta.data.content[0].text;
}

// ---------------------------------------------------------------------------
// MCP — Status
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
    res.json({
        status:   "Servidor MCP Online",
        versao:   "1.0.0",
        porta:    PORT,
        protocolo: "MCP over HTTP"
    });
});

// ---------------------------------------------------------------------------
// MCP — Descoberta de ferramentas
// Clientes MCP chamam este endpoint para saber o que o servidor oferece.
// ---------------------------------------------------------------------------
app.get('/mcp/tools', async (req, res) => {
    try {
        // Repassa a lista de ferramentas direto do RAG
        const resposta = await axios.get(`${RAG_URL}/mcp/tools`);
        return res.json(resposta.data);
    } catch (err) {
        console.error('❌ Erro ao buscar ferramentas do RAG:', err.message);
        return res.status(502).json({ erro: "Não foi possível contactar o serviço de RAG." });
    }
});

// ---------------------------------------------------------------------------
// MCP — Execução de ferramenta (JSON-RPC over HTTP)
// Este é o endpoint principal do protocolo MCP.
// Recebe: { tool: string, arguments: object }
// Devolve: { content: [{ type: "text", text: string }] }
// ---------------------------------------------------------------------------
app.post('/mcp/tools/call', async (req, res) => {
    const { tool, arguments: args } = req.body;

    if (!tool || !args) {
        return res.status(422).json({
            erro: "Corpo inválido. Esperado: { tool: string, arguments: object }"
        });
    }

    console.log(`\n========================================`);
    console.log(`⚙️  MCP acionado`);
    console.log(`🔧 Ferramenta: ${tool}`);
    console.log(`📥 Argumentos:`, args);
    console.log(`========================================`);

    // Roteador de ferramentas
    switch (tool) {

        // ------------------------------------------------------------------
        // Ferramenta: consultar_documentos_aula
        // Delega ao RAG e devolve a resposta no formato MCP
        // ------------------------------------------------------------------
        case "consultar_documentos_aula": {
            const query = args.query;
            if (!query) {
                return res.status(422).json({ erro: "O argumento 'query' é obrigatório." });
            }

            try {
                console.log(`🤔 Consultando RAG: "${query}"`);
                const texto = await consultarRAG(query);
                console.log(`✅ Resposta recebida do RAG.`);

                return res.json({
                    content: [{ type: "text", text: texto }]
                });
            } catch (err) {
                console.error('❌ Erro ao consultar RAG:', err.message);
                return res.status(502).json({
                    erro: "Erro ao consultar o serviço de RAG.",
                    detalhes: err.message
                });
            }
        }

        // ------------------------------------------------------------------
        // Ferramenta desconhecida
        // ------------------------------------------------------------------
        default:
            return res.status(404).json({
                erro: `Ferramenta '${tool}' não encontrada neste servidor MCP.`
            });
    }
});

// ---------------------------------------------------------------------------
// MCP — Health check (útil para o gateway saber se o MCP está vivo)
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
    try {
        const ragHealth = await axios.get(`${RAG_URL}/health`);
        return res.json({
            mcp_status:  "ok",
            rag_status:  ragHealth.data.status,
            rag_pronto:  ragHealth.data.rag_carregado,
            rag_chunks:  ragHealth.data.chunks,
        });
    } catch (err) {
        return res.status(502).json({
            mcp_status: "ok",
            rag_status: "indisponível",
            erro:       err.message
        });
    }
});

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor MCP rodando em http://127.0.0.1:${PORT}`);
    console.log(`🛠️  Ferramentas disponíveis: consultar_documentos_aula`);
    console.log(`📡 RAG esperado em: ${RAG_URL}`);
});