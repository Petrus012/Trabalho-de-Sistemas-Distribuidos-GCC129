const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT            = 8000;
// Perguntas do aluno passam pelo Servidor MCP (protocolo MCP).
const MCP_SERVICE_URL = 'http://127.0.0.1:8002';
// Endpoints administrativos vão direto ao Microserviço de RAG.
const RAG_SERVICE_URL = 'http://127.0.0.1:8001';

// Rota padrão para ver se o Gateway está vivo
app.get('/', (req, res) => {
    res.json({ status: "API Gateway (Node.js/Express) Online", porta: PORT });
});

// ---------------------------------------------------------------------------
// Pergunta do aluno → roteada para o Servidor MCP (:8002)
// O MCP executa a ferramenta e delega a busca ao RAG internamente.
// ---------------------------------------------------------------------------
app.post('/perguntar', async (req, res) => {
    const { pergunta } = req.body;

    if (!pergunta) {
        return res.status(422).json({ erro: "O campo 'pergunta' é obrigatório." });
    }

    console.log(`\n========================================`);
    console.log(`📥 Gateway Node.js recebeu: "${pergunta}"`);
    console.log(`🔀 Roteando pedido para o Servidor MCP (:8002)...`);

    try {
        // Chama o Servidor MCP no formato do protocolo MCP
        const respostaMcp = await axios.post(
            `${MCP_SERVICE_URL}/mcp/tools/call`,
            {
                tool: "consultar_documentos_aula",
                arguments: { query: pergunta }
            }
        );

        // A resposta MCP vem em blocos de conteúdo — pega o texto do primeiro bloco
        const textoResposta = respostaMcp.data.content[0].text;

        console.log(`✅ Resposta recebida do MCP com sucesso! Devolvendo para o usuário.`);
        console.log(`========================================`);

        // Mantém o mesmo formato de resposta que o frontend espera
        return res.json({ resposta: textoResposta });

    } catch (error) {
        console.error(`❌ Erro ao conectar com o Servidor MCP:`, error.message);
        return res.status(500).json({
            erro: "Erro interno no Gateway ao tentar falar com o serviço MCP.",
            detalhes: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// Rotas administrativas → repassadas DIRETO ao Microserviço de RAG (:8001)
// (é a segunda seta do diagrama: Gateway → RAG)
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
    try {
        const r = await axios.get(`${RAG_SERVICE_URL}/health`);
        return res.json(r.data);
    } catch (error) {
        return res.status(502).json({ erro: "RAG indisponível.", detalhes: error.message });
    }
});

app.post('/debug', async (req, res) => {
    try {
        const r = await axios.post(`${RAG_SERVICE_URL}/debug`, req.body);
        return res.json(r.data);
    } catch (error) {
        return res.status(502).json({ erro: "Erro ao consultar /debug no RAG.", detalhes: error.message });
    }
});

app.post('/reindexar', async (req, res) => {
    try {
        const r = await axios.post(`${RAG_SERVICE_URL}/reindexar`);
        return res.json(r.data);
    } catch (error) {
        return res.status(502).json({ erro: "Erro ao reindexar no RAG.", detalhes: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API Gateway rodando em http://127.0.0.1:${PORT}`);
    console.log(`🔧 Perguntas → MCP (${MCP_SERVICE_URL})`);
    console.log(`🛠️  Admin (/health, /debug, /reindexar) → RAG (${RAG_SERVICE_URL})`);
});
