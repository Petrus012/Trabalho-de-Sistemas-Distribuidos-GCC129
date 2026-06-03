import { useState } from 'react';

interface ChatMessage {
  sender: 'aluno' | 'ia';
  text: string;
}

export default function App() {
  const [pergunta, setPergunta] = useState('');
  const [historico, setHistorico] = useState<ChatMessage[]>([]);
  const [carregando, setCarregando] = useState(false);

  const enviarPergunta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pergunta.trim() || carregando) return;

    const novasMensagens = [...historico, { sender: 'aluno', text: pergunta } as ChatMessage];
    setHistorico(novasMensagens);
    setPergunta('');
    setCarregando(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta })
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
      maxWidth: '700px', 
      height: '85vh',
      margin: '30px auto', 
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #eef2f5', 
      borderRadius: '16px', 
      boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
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
        background: '#fff'
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
            <span style={{ fontSize: '12px', color: '#64748b' }}>Baseado no PDF da aula · Llama 3</span>
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
        gap: '16px'
      }}>
        {historico.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>💬</span>
            <p style={{ margin: 0, fontSize: '15px' }}>Faça uma pergunta sobre o conteúdo da aula</p>
          </div>
        )}

        {historico.map((msg, index) => (
          <div key={index} style={{ display: 'flex', justifyContent: msg.sender === 'aluno' ? 'flex-end' : 'flex-start' }}>
            <div style={{ 
              background: msg.sender === 'aluno' ? '#0284c7' : '#f1f5f9', 
              color: msg.sender === 'aluno' ? '#fff' : '#1e293b', 
              padding: '12px 18px', 
              borderRadius: msg.sender === 'aluno' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
              maxWidth: '75%',
              fontSize: '15px',
              lineHeight: '1.5',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#f1f5f9', color: '#64748b', padding: '12px 18px', borderRadius: '18px 18px 18px 4px', fontSize: '14px', fontStyle: 'italic' }}>
              🤖 Processando resposta com Llama 3...
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Caixa de entrada com Lápis e Botão Circular */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid #f0f2f5', background: '#fff' }}>
        <form onSubmit={enviarPergunta} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '28px', 
          padding: '6px 8px 6px 18px',
          gap: '10px'
        }}>
          {/* Ícone do Lápis */}
          <span style={{ color: '#94a3b8', fontSize: '16px', display: 'flex', alignItems: 'center' }}>✏️</span>
          
          <input 
            type="text" 
            value={pergunta} 
            onChange={(e) => setPergunta(e.target.value)} 
            placeholder="Pergunte algo sobre a aula..." 
            style={{ 
              flex: 1, 
              padding: '10px 0',
              background: 'transparent',
              border: 'none', 
              outline: 'none',
              fontSize: '15px',
              color: '#334155'
            }}
            disabled={carregando}
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
              cursor: carregando ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'background 0.2s',
              opacity: carregando ? 0.6 : 1
            }} 
            disabled={carregando}
          >
            ➤
          </button>
        </form>
      </div>

    </div>
  );
}