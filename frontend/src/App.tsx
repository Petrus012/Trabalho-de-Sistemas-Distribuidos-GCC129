import { useState, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  sender: 'aluno' | 'ia';
  text: string;
}

// Formata a resposta do ARIA para leitura. O modelo costuma emitir as alternativas
// de múltipla escolha "a) ... b) ... c) ..." TUDO numa linha só — aqui quebramos
// cada alternativa em sua própria linha (lista), separamos "Questão N" e destacamos
// "Resposta correta:". Conservador: só mexe nas alternativas quando há >=3 marcadores
// seguidos de texto (evita estragar prosa que use "a)" solto).
function formatarResposta(texto: string): string {
  let t = texto || '';
  t = t.replace(/\s*(Quest(?:ã|a)o\s*\d+)/gi, '\n\n$1');
  t = t.replace(/[ \t]*(Resposta\s+correta\s*:?)/gi, '\n\n$1');
  // (?<![A-Za-zÀ-ÿ]) garante que a letra é um marcador de verdade (vem depois de
  // espaço/início/"("), e não o fim de uma palavra — senão "(Privacidade)" virava
  // "Privacidad" + bullet "e)". Idem "suportabilidade)" etc.
  const qtd = (t.match(/(?<![A-Za-zÀ-ÿ])[a-eA-E]\)\s+[A-Za-zÀ-ÿ]/g) || []).length;
  if (qtd >= 3) {
    t = t.replace(/[ \t]*(?<![A-Za-zÀ-ÿ])([a-eA-E])\)\s+(?=[A-Za-zÀ-ÿ])/g, '\n- **$1)** ');
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

// Bolha de mensagem MEMOIZADA: não re-renderiza (nem re-parseia o Markdown) quando o
// usuário digita no input — só quando a própria mensagem muda. Sem isto, cada tecla
// re-parseava TODAS as respostas do histórico → lentidão forte em conversas longas.
const MessageItem = memo(function MessageItem({ msg }: { msg: ChatMessage }) {
  const ehAluno = msg.sender === 'aluno';
  return (
    <div style={{ display: 'flex', justifyContent: ehAluno ? 'flex-end' : 'flex-start' }}>
      <div style={{
        background: ehAluno ? '#0284c7' : '#f1f5f9',
        color: ehAluno ? '#fff' : '#1e293b',
        padding: '12px 18px',
        borderRadius: ehAluno ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        maxWidth: '75%',
        fontSize: '15px',
        lineHeight: '1.5',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        {ehAluno ? msg.text : (
          <div className="markdown-resposta">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatarResposta(msg.text)}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});

export default function App() {
  const [pergunta, setPergunta] = useState('');
  const [historico, setHistorico] = useState<ChatMessage[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviandoPdf, setEnviandoPdf] = useState(false);
  const [materialNome, setMaterialNome] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // Identificador da conversa — persiste no navegador para dar memória ao ARIA
  const [sessionId] = useState<string>(() => {
    const existente = localStorage.getItem('aria_session_id');
    if (existente) return existente;
    const novo = crypto.randomUUID();
    localStorage.setItem('aria_session_id', novo);
    return novo;
  });

  const enviarPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
      setHistorico(h => [...h, { sender: 'ia', text: '⚠️ Por favor, envie um arquivo **.pdf**.' }]);
      e.target.value = '';
      return;
    }

    setEnviandoPdf(true);
    setHistorico(h => [...h, { sender: 'ia', text: `📤 Processando **${arquivo.name}**... isso pode levar alguns minutos para materiais grandes.` }]);

    try {
      const form = new FormData();
      form.append('arquivo', arquivo);

      const response = await fetch('http://127.0.0.1:8000/upload', { method: 'POST', body: form });
      const data = await response.json();

      if (response.ok) {
        setMaterialNome(arquivo.name);
        setHistorico(h => [...h, { sender: 'ia', text: `✅ **${arquivo.name}** indexado! Agora pode me perguntar sobre esse material.` }]);
      } else {
        setHistorico(h => [...h, { sender: 'ia', text: `❌ Não consegui indexar o PDF: ${data.detalhes || data.erro || 'erro desconhecido'}` }]);
      }
    } catch (error) {
      setHistorico(h => [...h, { sender: 'ia', text: '❌ Erro ao enviar o PDF para o API Gateway.' }]);
    } finally {
      setEnviandoPdf(false);
      e.target.value = '';
    }
  };

  const enviarPergunta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pergunta.trim() || carregando || enviandoPdf) return;

    const novasMensagens = [...historico, { sender: 'aluno', text: pergunta } as ChatMessage];
    setHistorico(novasMensagens);
    setPergunta('');
    setCarregando(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, session_id: sessionId })
      });
      
      const data = await response.json();
      setHistorico([...novasMensagens, { sender: 'ia', text: data.resposta || data.erro }]);
    } catch (error) {
      setHistorico([...novasMensagens, { sender: 'ia', text: 'Erro ao conectar com o API Gateway.' }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      margin: 0,
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      overflow: 'hidden'
    }}>
      
      {/* HEADER: Assistente de Estudos com Bolinha Verde */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f2f5',
        background: '#fff',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '12px', 
            background: '#10b981', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            🎓
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 600 }}>Assistente de Estudos</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {materialNome ? `📄 ${materialNome}` : 'Baseado no PDF da aula'}
            </span>
          </div>
        </div>
        {/* Indicador Status Online */}
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
      </div>

      {/* ÁREA DO CHAT / HISTÓRICO */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        {historico.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>💬</span>
            <p style={{ margin: 0, fontSize: '15px' }}>Faça uma pergunta sobre o conteúdo da aula</p>
          </div>
        )}

        {historico.map((msg, index) => (
          <MessageItem key={index} msg={msg} />
        ))}

        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#f1f5f9', color: '#64748b', padding: '12px 18px', borderRadius: '18px 18px 18px 4px', fontSize: '14px', fontStyle: 'italic' }}>
              🤖 ARIA está processando a sua resposta...
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Caixa de entrada com Lápis e Botão Circular */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid #f0f2f5', background: '#fff', width: '100%', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <form onSubmit={enviarPergunta} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '28px', 
          padding: '6px 8px 6px 18px',
          gap: '10px'
        }}>
          {/* Input de arquivo escondido + botão de anexar PDF */}
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={enviarPdf}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            title="Enviar um PDF para o assistente estudar"
            disabled={enviandoPdf || carregando}
            style={{
              background: 'transparent',
              border: 'none',
              color: enviandoPdf ? '#0ea5e9' : '#94a3b8',
              fontSize: '18px',
              cursor: (enviandoPdf || carregando) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
          >
            {enviandoPdf ? '⏳' : '📎'}
          </button>

          {/* Ícone do Lápis */}
          <span style={{ color: '#94a3b8', fontSize: '16px', display: 'flex', alignItems: 'center' }}>✏️</span>

          <input
            type="text"
            value={pergunta} 
            onChange={(e) => setPergunta(e.target.value)} 
            placeholder={enviandoPdf ? 'Indexando o material...' : 'Pergunte algo sobre a aula...'}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              color: '#334155'
            }}
            disabled={carregando || enviandoPdf}
          />
          
          {/* Botão Circular de Enviar */}
          <button 
            type="submit" 
            style={{ 
              width: '40px', 
              height: '40px', 
              background: '#0ea5e9', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '50%', 
              cursor: (carregando || enviandoPdf) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'background 0.2s',
              opacity: (carregando || enviandoPdf) ? 0.6 : 1
            }}
            disabled={carregando || enviandoPdf}
          >
            ➤
          </button>
        </form>
      </div>

    </div>
  );
}