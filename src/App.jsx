import React, { useEffect, useMemo, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { liquidGlassConfig } from './theme/liquidGlassConfig.js';
import ExamModeToggle from './components/Header/ExamModeToggle.js';
import ChatBubble from './components/Chat/ChatBubble.js';
import SidebarPanel from './components/Sidebar/SidebarPanel.js';
import ProgressCard from './components/Gamification/ProgressCard.js';
import confetti from 'canvas-confetti';

function readLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    return v;
  } catch (e) {
    return fallback;
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

async function apiFetch(path, options) {
  const url = window.location.origin + path;
  const res = await fetch(url, options);
  return res;
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [examModeEnabled, setExamModeEnabled] = useState(readLocal('g9_exam_mode', 'false') === 'true');

  const [subject, setSubject] = useState(readLocal('g9_subject', 'General'));
  const [language, setLanguage] = useState(readLocal('g9_language', 'English'));

  const [chats, setChats] = useState(() => readJson('g9_chats', []));
  const [activeChatId, setActiveChatId] = useState(readLocal('g9_active', null));

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [points, setPoints] = useState(0);
  const [streakDays, setStreakDays] = useState(1);
  const [badges, setBadges] = useState([]);
  const prevBadgesCountRef = useRef(0);

  const activeChat = useMemo(() => {
    return chats.find((c) => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

  useEffect(() => {
    writeLocal('g9_subject', subject);
  }, [subject]);

  useEffect(() => {
    writeLocal('g9_language', language);
  }, [language]);

  useEffect(() => {
    writeJson('g9_chats', chats);
  }, [chats]);

  useEffect(() => {
    if (activeChatId === null) return;
    writeLocal('g9_active', String(activeChatId));
  }, [activeChatId]);

  useEffect(() => {
    writeLocal('g9_exam_mode', examModeEnabled ? 'true' : 'false');
  }, [examModeEnabled]);

  useEffect(() => {
    prevBadgesCountRef.current = badges.length;
  }, []);

  useEffect(() => {
    const prev = prevBadgesCountRef.current;
    if (badges.length > prev) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    prevBadgesCountRef.current = badges.length;
  }, [badges]);

  function ensureChat() {
    if (activeChat) return activeChat;
    const id = String(Date.now());
    const newChat = { id, title: 'New Chat', messages: [] };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
    return newChat;
  }

  async function sendMessage() {
    const text = String(inputText || '').trim();
    if (!text || isSending) return;

    const chat = ensureChat();

    const langTag = language === 'Sinhala' ? '[සිංහල]' : '[English]';
    const userText = langTag + ' ' + text;

    setInputText('');
    setIsSending(true);

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chat.id) return c;
        const next = {
          ...c,
          messages: [...c.messages, { role: 'user', content: userText }, { role: 'ai', content: 'Thinking…' }]
        };
        return next;
      })
    );

    const history = (() => {
      const current = chats.find((c) => c.id === chat.id) || chat;
      const msgs = (current.messages || [])
        .filter((m) => m && (m.role === 'user' || m.role === 'ai') && m.content && m.content !== 'Thinking…')
        .slice(-20)
        .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.content).slice(0, 1200) }));
      return msgs;
    })();

    try {
      const res = await apiFetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          language,
          student_question: text,
          history,
          title: chat.title,
          email: 'guest@student.com'
        })
      });

      if (!res.ok) throw new Error('HTTP_' + res.status);

      const data = await res.json();
      if (!data || !data.answer) throw new Error('INVALID_RESPONSE');

      const answer = data.answer;

      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chat.id) return c;
          const nextMessages = [...c.messages];
          for (let i = nextMessages.length - 1; i >= 0; i--) {
            if (nextMessages[i].role === 'ai' && nextMessages[i].content === 'Thinking…') {
              nextMessages[i] = { role: 'ai', content: answer };
              break;
            }
          }
          return { ...c, messages: nextMessages };
        })
      );
    } catch (e) {
      const msg = '⚠️ Message failed to send. Please check your connection or try again later.';
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chat.id) return c;
          const nextMessages = [...c.messages];
          for (let i = nextMessages.length - 1; i >= 0; i--) {
            if (nextMessages[i].role === 'ai' && nextMessages[i].content === 'Thinking…') {
              nextMessages[i] = { role: 'ai', content: msg };
              break;
            }
          }
          return { ...c, messages: nextMessages };
        })
      );
    } finally {
      setIsSending(false);
    }
  }

  function renderMainPanel() {
    if (examModeEnabled) {
      return (
        <div style={{ padding: '1rem' }}>
          <LiquidGlass
            {...liquidGlassConfig}
            className="g9-glass-margin"
          >
            <div>
              <div className="g9-fw-700" style={{ marginBottom: "0.5rem" }}>Exam Mode</div>
              <div style={{ opacity: 0.9, marginBottom: "0.75rem" }}>Answer these to begin:</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div>1) Real exam or practice?</div>
                <div>2) Which term test? (First/Second/Third)</div>
                <div>3) Which subject?</div>
              </div>
            </div>
          </LiquidGlass>
        </div>
      );
    }

    if (!activeChat || (activeChat.messages || []).length === 0) {
      return (
        <div style={{ padding: '1rem' }}>
          <LiquidGlass {...liquidGlassConfig} className="g9-glass-margin">
            <div>
              <div className="g9-fw-700" style={{ marginBottom: '0.25rem' }}>Welcome back!</div>
              <div style={{ opacity: 0.9 }}>Ask me anything and I’ll help you learn Grade 9 topics.</div>
            </div>
          </LiquidGlass>
        </div>
      );
    }

    return (
      <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
        {(activeChat.messages || []).map((m, idx) => (
          <ChatBubble key={idx} role={m.role} content={m.content} />
        ))}
      </div>
    );
  }

  useEffect(() => {
    async function loadGamification() {
      try {
        const res = await apiFetch('/gamification/get_points?email=' + encodeURIComponent('guest@student.com'), {
          method: 'GET'
        });
        if (res.ok) {
          const data = await res.json();
          const g = data && data.data ? data.data : null;
          if (g) {
            setPoints(g.points || 0);
            setStreakDays(g.streak_days || 1);
          }
        }
      } catch (e) {}

      try {
        const res = await apiFetch('/gamification/get_badges?email=' + encodeURIComponent('guest@student.com'), {
          method: 'GET'
        });
        if (res.ok) {
          const data = await res.json();
          const b = data && data.data && Array.isArray(data.data.badges) ? data.data.badges : [];
          setBadges(b);
        }
      } catch (e) {}
    }

    loadGamification();
  }, []);

  return (
    <div className="app" role="application" aria-label="Grade 9 AI Tutor">
      <aside className={"sidebar g9-sidebar" + (sidebarCollapsed ? ' g9-sidebar-collapsed' : '')} aria-label="Sidebar" role="region">
        <SidebarPanel activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'chats' ? (
            <div style={{ padding: '1rem' }}>
              <div className="g9-fw-700" style={{ marginBottom: '0.5rem' }}>Recent Chats</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {(chats || []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveChatId(c.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{c.title || 'Chat'}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>{(c.messages || []).slice(-1)[0]?.content || ''}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'settings' ? (
            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Subject</div>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 10 }}>
                  <option>General</option>
                  <option>Math</option>
                  <option>Science</option>
                  <option>History</option>
                  <option>English</option>
                  <option>Sinhala</option>
                </select>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Language</div>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 10 }}>
                  <option value="English">English</option>
                  <option value="Sinhala">සිංහල</option>
                </select>
              </div>
            </div>
          ) : null}

          {activeTab === 'gamification' ? (
            <div style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
              <ProgressCard title="Points" value={String(points)} />
              <ProgressCard title="Streak" value={String(streakDays) + ' day' + (streakDays === 1 ? '' : 's')} />
              <ProgressCard title="Badges" value={String(badges.length)} />
              <ProgressCard title="Next badge" value={points < 100 ? '100' : String(Math.ceil(points / 500) * 500)} progress={(points % 100) / 100} />
            </div>
          ) : null}
        </SidebarPanel>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <header className="app-header" role="banner">
          <div className="brand">
            <div className="logo">G9</div>
            <div>
              <h1 className="brand-title gradient-text">The Tutor</h1>
              <div className="subtitle">AI Agent made for tutoring Grade 9 students</div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="icon-btn sidebar-toggle"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              ☰
            </button>

            <ExamModeToggle enabled={examModeEnabled} onChange={setExamModeEnabled} />
          </div>
        </header>

        <main className="chat" role="main" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {renderMainPanel()}

          <div className="composer" role="region" aria-label="Message composer" style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem' }}>
            <input
              className="input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask me anything..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <LiquidGlass
              {...liquidGlassConfig}
              padding="0.5rem 0.75rem"
              cornerRadius={14}
              className="g9-glass-margin"
              onClick={sendMessage}
            >
              <button type="button" className="send" disabled={isSending} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                Send
              </button>
            </LiquidGlass>
          </div>
        </main>
      </div>
    </div>
  );
}
