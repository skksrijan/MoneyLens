import React, { useState, useRef, useEffect } from 'react';
import api from '../api';
import { Sparkles, Send, Bot, User, Loader2 } from 'lucide-react';

const AIPage = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm FinanceGuru, your AI wealth advisor. I have direct access to your live transactions, monthly category totals, and budget limits. How can I help you optimize your finances today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const prompt = textToSend || input;
    if (!prompt.trim() || loading) return;

    const userMsg = { role: 'user', content: prompt };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history excluding initial intro
      const history = nextMessages
        .slice(1, -1)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.post('/ai/chat', {
        message: prompt,
        history
      });

      if (res.data.success) {
        setMessages([...nextMessages, { role: 'assistant', content: res.data.response }]);
      }
    } catch (err) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: "Sorry, I had trouble analyzing your financial data. Please make sure GEMINI_API_KEY or GROQ_API_KEY is configured in your environment."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    "Am I over budget in any category this month?",
    "How much did I spend on dining vs groceries?",
    "Where can I cut expenses to increase savings?",
    "Summarize my financial health this month."
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>
          <Sparkles size={16} />
          <span>FinanceGuru • Context-Aware AI Advisor</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Intelligent Wealth & Spending Guidance</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
          Ask complex questions about your live transactions, monthly deficits, and budgeting limits.
        </p>
      </div>

      {/* Suggested Prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="btn btn-outline btn-sm"
            style={{ borderRadius: '16px', fontSize: '12px' }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        <div className="chat-messages">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <Bot size={18} />
                  </div>
                )}

                <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>

                {isUser && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                <Bot size={18} />
              </div>
              <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>FinanceGuru is calculating insights...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            className="form-input"
            placeholder="Ask FinanceGuru anything about your spending..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary" style={{ padding: '0 20px' }}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPage;
