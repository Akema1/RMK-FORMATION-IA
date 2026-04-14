import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import type { Seminar } from '../data/seminars';

// ─── Types ───

interface ChatWidgetProps {
  mode: 'client' | 'admin';
  seminars?: Seminar[];
  userName?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Server-rendered chat call ───
// No client-side system prompt. We send (templateId, seminars) and let
// api/prompts.ts render the system prompt server-side. See api/app.ts:/api/ai/chat.
//
// SECURITY: the public /api/ai/chat endpoint only accepts mode='client' by
// design (the server-side schema uses z.literal("client")). If Phase 2 adds
// an admin chat surface, it must go through a separate authed route — do NOT
// unlock admin mode on this public endpoint. userName is still forwarded for
// potential future use but is ignored by the client-mode prompt.
async function sendChatMessage(
  seminars: Seminar[] | undefined,
  messages: ChatMessage[],
  userName: string | undefined
): Promise<string> {
  const apiMessages = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const varsSeminars = (seminars || []).slice(0, 10).map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    week: s.week,
  }));

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: 'chat',
      vars: { mode: 'client', seminars: varsSeminars, userName },
      messages: apiMessages,
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Le serveur backend ne semble pas actif. Lancez-le avec: npm run dev'
    );
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Erreur serveur (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text || 'Pas de reponse.';
}

// ─── Colors ───

const NAVY = '#1B2A4A';
const GOLD = '#C9A84C';
const SURFACE = '#FAF9F6';

// ─── Component ───

export function ChatWidget({ mode, seminars, userName }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(seminars, updatedMessages, userName);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Erreur de connexion. Veuillez reessayer.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const headerTitle = mode === 'client' ? 'Assistant RMK' : 'Assistant Admin';
  const greeting =
    mode === 'client'
      ? 'Bonjour ! Je suis votre assistant RMK Conseils. Comment puis-je vous aider ?'
      : `Bonjour${userName ? ` ${userName}` : ''} ! Je suis votre assistant admin. Comment puis-je vous aider ?`;

  return (
    <>
      {/* ─── Floating Bubble ─── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir le chat"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: `linear-gradient(135deg, ${GOLD}, #A88A3D)`,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(201,168,76,0.4)',
            zIndex: 9999,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(201,168,76,0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.4)';
          }}
        >
          <MessageCircle size={24} color="#fff" />
        </button>
      )}

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            height: 520,
            borderRadius: 16,
            background: SURFACE,
            boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'chatWidgetSlideUp 0.3s ease-out',
            fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
          }}
        >
          <style>{`
            @keyframes chatWidgetSlideUp {
              from { opacity: 0; transform: translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes chatWidgetDot {
              0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>

          {/* ─── Header ─── */}
          <div
            style={{
              background: NAVY,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${GOLD}, #A88A3D)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageCircle size={16} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                  {headerTitle}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  En ligne
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Fermer le chat"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                padding: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
            >
              <X size={18} color="#fff" />
            </button>
          </div>

          {/* ─── Messages Area ─── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Welcome message */}
            {messages.length === 0 && !isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: '#fff',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: NAVY,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${GOLD}`,
                }}
              >
                {greeting}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    background: msg.role === 'user' ? NAVY : '#fff',
                    color: msg.role === 'user' ? '#fff' : NAVY,
                    borderRadius:
                      msg.role === 'user'
                        ? '14px 14px 4px 14px'
                        : '14px 14px 14px 4px',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.5,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    borderLeft:
                      msg.role === 'assistant' ? `3px solid ${GOLD}` : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(27,42,74,0.4)',
                    marginTop: 4,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                    paddingLeft: msg.role === 'assistant' ? 6 : 0,
                    paddingRight: msg.role === 'user' ? 6 : 0,
                  }}
                >
                  {msg.timestamp.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: '#fff',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '12px 18px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  borderLeft: `3px solid ${GOLD}`,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((j) => (
                  <span
                    key={j}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: GOLD,
                      display: 'inline-block',
                      animation: `chatWidgetDot 1.4s ease-in-out ${j * 0.16}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ─── Input Area ─── */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Tapez votre message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 24,
                padding: '10px 16px',
                fontSize: 13,
                outline: 'none',
                background: SURFACE,
                color: NAVY,
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = GOLD;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Envoyer"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background:
                  input.trim() && !isLoading
                    ? `linear-gradient(135deg, ${GOLD}, #A88A3D)`
                    : 'rgba(0,0,0,0.06)',
                border: 'none',
                cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, transform 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !isLoading) {
                  e.currentTarget.style.transform = 'scale(1.08)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Send
                size={16}
                color={input.trim() && !isLoading ? '#fff' : 'rgba(0,0,0,0.25)'}
              />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
