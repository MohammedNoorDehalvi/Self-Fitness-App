import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../utils/api';

const Markdown = ({ text }) => {
  if (!text) return null;
  return (
    <div style={{ lineHeight: 1.75 }}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        const renderInline = (str) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
              : <span key={j}>{p}</span>
          );
        };
        if (line.match(/^[•\-\*] /)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, paddingLeft: 4 }}>
              <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }}>▸</span>
              <span>{renderInline(line.replace(/^[•\-\*] /, ''))}</span>
            </div>
          );
        }
        if (line.match(/^\d+\./)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, paddingLeft: 4 }}>
              <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, minWidth: 16, fontWeight: 700 }}>
                {line.match(/^(\d+)/)[1]}.
              </span>
              <span>{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
            </div>
          );
        }
        return <div key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</div>;
      })}
    </div>
  );
};

const QUICK_PROMPTS = [
  { label: '🌅 Daily Brief', text: 'Give me my personalized daily health brief based on my recent data.' },
  { label: '📊 Health Summary', text: 'Summarize my health based on my recent logs and tell me what to focus on.' },
  { label: '😴 Sleep Analysis', text: 'Analyze my sleep patterns from my logs and give me specific improvement tips.' },
  { label: '🏃 Exercise Plan', text: 'Based on my profile and current activity level, suggest a weekly workout plan.' },
  { label: '🥗 Meal Advice', text: 'Based on my macro targets and recent eating habits, what should I eat today?' },
  { label: '⚖️ Weight Progress', text: 'How is my weight trending and what adjustments should I make?' },
  { label: '🎯 Goal Check-in', text: 'How am I progressing towards my current goals? What should I prioritize?' },
  { label: '💧 Hydration Check', text: 'Am I drinking enough water for my body weight and activity level?' },
  { label: '🧘 Stress & Recovery', text: 'How can I improve my recovery and manage stress based on my data?' },
  { label: '🌍 Local Tips', text: 'Give me health and exercise tips specifically suited to my location and current time of day.' },
];

const resolveLocation = async () => {
  const getBrowserCoords = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 }
    );
  });

  try {
    const coords = await getBrowserCoords();
    if (coords) {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const geo = await r.json();
      const addr = geo.address || {};
      return {
        lat: coords.lat, lon: coords.lon,
        city: addr.city || addr.town || addr.village || addr.suburb || null,
        region: addr.state || addr.county || null,
        country: addr.country || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: 'gps'
      };
    }
    const r = await fetch('https://ipapi.co/json/');
    const ip = await r.json();
    if (ip && !ip.error) {
      return {
        city: ip.city || null, region: ip.region || null,
        country: ip.country_name || null,
        timezone: ip.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: 'ip'
      };
    }
  } catch (_) { }
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, source: 'timezone' };
};

const LocationPill = ({ location, loading }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: location ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${location ? 'rgba(0,212,255,0.25)' : 'var(--border)'}`,
    borderRadius: 999, padding: '4px 12px', fontSize: 11,
    color: location ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 500
  }}>
    {loading
      ? <><span>⏳</span> Locating...</>
      : location
        ? <><span>📍</span>{[location.city, location.region, location.country].filter(Boolean).join(', ') || 'Location detected'}</>
        : <><span>📍</span> Location unknown</>
    }
  </div>
);

const MessageBubble = ({ msg, profile, isStreaming }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isUser ? 13 : 17, fontWeight: 700,
        background: isUser ? 'var(--gradient-accent)' : 'linear-gradient(135deg, #1e3a5f, #0d1a2e)',
        border: isUser ? 'none' : '1px solid var(--border)',
        color: isUser ? '#000' : 'var(--text-primary)',
        boxShadow: isUser ? '0 0 12px rgba(0,212,255,0.3)' : 'none'
      }}>
        {isUser ? (profile?.name?.[0] || 'U').toUpperCase() : '✦'}
      </div>
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 5, color: isUser ? 'var(--accent-cyan)' : 'var(--accent-purple)',
          textAlign: isUser ? 'right' : 'left'
        }}>
          {isUser ? (profile?.name || 'You') : 'VitaAI'}
        </div>
        <div style={{
          background: isUser
            ? 'linear-gradient(135deg, rgba(0,212,255,0.24), rgba(139,92,246,0.16))'
            : 'rgba(255,255,255,0.12)',
          border: `1px solid ${isUser ? 'rgba(0,212,255,0.25)' : 'var(--border)'}`,
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          padding: '13px 16px', fontSize: 14, color: 'var(--text-secondary)',
          backdropFilter: 'var(--glass-blur-sm)',
          WebkitBackdropFilter: 'var(--glass-blur-sm)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)'
        }}>
          {isUser
            ? <span style={{ color: 'var(--text-primary)' }}>{msg.content}</span>
            : <Markdown text={msg.content} />
          }
          {isStreaming && (
            <span style={{
              display: 'inline-block', width: 2, height: 16,
              background: 'var(--accent-cyan)', marginLeft: 3, verticalAlign: 'middle',
              animation: 'blink 0.8s step-end infinite'
            }} />
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
};

const TypingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'linear-gradient(135deg, #1e3a5f, #0d1a2e)',
      border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17
    }}>✦</div>
    <div style={{
      background: 'rgba(255,255,255,0.12)', border: '1px solid var(--border)',
      borderRadius: '4px 18px 18px 18px', padding: '13px 18px',
      display: 'flex', gap: 5, alignItems: 'center',
      backdropFilter: 'var(--glass-blur-sm)',
      WebkitBackdropFilter: 'var(--glass-blur-sm)'
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-cyan)',
          animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
  </div>
);


const CHAT_STORAGE_KEY = 'vitaai.chat.sessions.v2';

const makeWelcomeMessages = (profile, location) => ([{
  id: 'welcome',
  role: 'assistant',
  content: `✦ **Welcome to VitaAI!**\n\nI'm your AI health assistant. I can read your profile, logs, goals, and routine analysis to help you improve inside the app.\n\nTry one of the quick prompts, or start a new chat from the sidebar.`,
  timestamp: new Date().toISOString()
}]);

const sessionTitleFromMessages = (messages = []) => {
  const firstUser = messages.find(m => m.role === 'user' && m.content);
  if (!firstUser) return 'New Chat';
  return firstUser.content.trim().slice(0, 28) + (firstUser.content.trim().length > 28 ? '…' : '');
};

const ensureWelcomeSession = (profile, location) => ({
  id: `session-${Date.now()}`,
  title: 'Current Chat',
  createdAt: new Date().toISOString(),
  messages: makeWelcomeMessages(profile, location)
});

export default function AIAssistant({ profile, toast }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(true);
  const [dailyBrief, setDailyBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');
  const [apiConfigured, setApiConfigured] = useState(!!localStorage.getItem('groq_api_key'));
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
  const messages = activeSession?.messages || [];

  const persistSessions = (nextSessions) => {
    setSessions(nextSessions);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(nextSessions));
    } catch (_) { }
  };

  const updateActiveSessionMessages = (nextMessages, extraPatch = {}) => {
    const targetId = activeSession?.id || activeSessionId;
    persistSessions((sessions || []).map(session => {
      if (session.id !== targetId) return session;
      const title = session.title === 'Current Chat' || session.title === 'New Chat'
        ? (nextMessages.some(m => m.role === 'user') ? sessionTitleFromMessages(nextMessages) : session.title)
        : session.title;
      return { ...session, ...extraPatch, title, messages: nextMessages };
    }));
  };

  useEffect(() => {
    (async () => {
      let stored = [];
      try {
        const raw = localStorage.getItem(CHAT_STORAGE_KEY);
        stored = raw ? JSON.parse(raw) : [];
      } catch (_) {
        stored = [];
      }

      if (!Array.isArray(stored) || stored.length === 0) {
        const welcomeSession = ensureWelcomeSession(profile, null);
        try {
          const history = await api.getChatHistory();
          if (history?.length) {
            welcomeSession.messages = history.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp
            }));
            welcomeSession.title = sessionTitleFromMessages(welcomeSession.messages);
          }
        } catch (e) {
          console.warn(e.message);
        }
        stored = [welcomeSession];
      }

      const normalized = stored.map((s, idx) => ({
        id: s.id || `session-${Date.now()}-${idx}`,
        title: s.title || (idx === 0 ? 'Current Chat' : 'New Chat'),
        createdAt: s.createdAt || new Date().toISOString(),
        messages: Array.isArray(s.messages) && s.messages.length
          ? s.messages
          : makeWelcomeMessages(profile, null)
      }));

      persistSessions(normalized);
      setActiveSessionId(normalized[0].id);

      try {
        const loc = await resolveLocation();
        setLocation(loc);
      } catch (_) {
        setLocation(null);
      } finally {
        setLocLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const startNewChat = () => {
    const newSession = {
      id: `session-${Date.now()}`,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: makeWelcomeMessages(profile, location)
    };
    persistSessions([newSession, ...(sessions || [])]);
    setActiveSessionId(newSession.id);
    setDailyBrief(null);
    setInput('');
    toast('New chat started', 'info');
  };

  const clearCurrentChat = async () => {
    const current = activeSession || ensureWelcomeSession(profile, location);
    const cleared = { ...current, title: 'New Chat', messages: makeWelcomeMessages(profile, location) };
    persistSessions((sessions.length ? sessions : [current]).map(s => s.id === current.id ? cleared : s));
    setActiveSessionId(cleared.id);
    setDailyBrief(null);
    setInput('');
    try {
      await api.clearChatHistory();
    } catch (_) { }
    toast('Current chat cleared', 'info');
  };

  const clearAllChats = async () => {
    const fresh = ensureWelcomeSession(profile, location);
    persistSessions([fresh]);
    setActiveSessionId(fresh.id);
    setDailyBrief(null);
    setInput('');
    try {
      await api.clearChatHistory();
    } catch (_) { }
    toast('All chats cleared', 'info');
  };

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date().toISOString() };
    const nextUserMessages = [...messages, userMsg];
    updateActiveSessionMessages(nextUserMessages);

    setInput('');
    setSending(true);
    setTyping(true);

    try {
      const res = await api.sendChat(msg, location);
      if (res.error) {
        if (res.error.includes('API key') || res.error.includes('not configured')) setApiConfigured(false);
        throw new Error(res.error);
      }
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response,
        timestamp: res.timestamp
      };
      const finalMessages = [...nextUserMessages, assistantMsg];
      updateActiveSessionMessages(finalMessages, { title: sessionTitleFromMessages(finalMessages) });
    } catch (e) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        timestamp: new Date().toISOString(),
        content: e.message.includes('API key') || e.message.includes('not configured') || e.message.includes('missing')
          ? `⚠️ **API Key Not Configured**\n\nTo enable the real AI:\n1. Get a free API key at **console.groq.com**\n2. Enter it in the field above\n3. Ask me again`
          : `⚠️ Error: ${e.message}`
      };
      updateActiveSessionMessages([...nextUserMessages, errorMsg], { title: sessionTitleFromMessages(nextUserMessages) });
    } finally {
      setSending(false);
      setTyping(false);
      inputRef.current?.focus();
    }
  }, [input, sending, location, messages, activeSession, activeSessionId, sessions]);

  const loadDailyBrief = async () => {
    setBriefLoading(true);
    try {
      const data = await api.getDailyBrief(location);
      setDailyBrief(data.brief);
    } catch (e) {
      toast('Could not load brief — check API key', 'error');
    } finally {
      setBriefLoading(false);
    }
  };

  const selectSession = (sessionId) => {
    setActiveSessionId(sessionId);
    setDailyBrief(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: 16,
        height: 'calc(100vh - 110px)',
        minHeight: 0,
        alignItems: 'stretch',
      }}
    >
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:.5} 50%{transform:translateY(-5px);opacity:1} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <aside
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--gradient-card)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Chats</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Old chats stay in the sidebar</div>
          </div>
          <button className="btn btn-primary" onClick={startNewChat} style={{ padding: '8px 12px', fontSize: 12 }}>＋ New Chat</button>
        </div>

        <div style={{ display: 'grid', gap: 8, overflowY: 'auto', paddingRight: 4, flex: 1, minHeight: 0 }}>
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => selectSession(session.id)}
              style={{
                textAlign: 'left',
                borderRadius: 12,
                padding: '12px 12px',
                border: `1px solid ${session.id === activeSessionId ? 'rgba(0,212,255,0.35)' : 'var(--border)'}`,
                background: session.id === activeSessionId ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{session.title || 'Chat'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(session.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={clearCurrentChat} style={{ flex: 1, fontSize: 12 }}>Clear Current</button>
          <button className="btn btn-ghost" onClick={clearAllChats} style={{ flex: 1, fontSize: 12 }}>Clear All</button>
        </div>
      </aside>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 className="section-title" style={{ marginBottom: 6 }}>✦ AI Health Assistant</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <LocationPill location={location} loading={locLoading} />
              <div style={{ fontSize: 11, color: 'var(--accent-purple)', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 999, padding: '4px 12px' }}>
                ✦ Groq · Llama 3.3 70B (Free)
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-green)', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 999, padding: '4px 12px' }}>
                ● Reads your real health data
              </div>
              {!apiConfigured && !groqKey && (
                <div style={{ fontSize: 11, color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '4px 12px' }}>
                  ⚠️ API key needed
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="password"
                placeholder="Enter Groq API Key (gsk_...)"
                value={groqKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setGroqKey(val);
                  localStorage.setItem('groq_api_key', val);
                  if (val) setApiConfigured(true);
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  width: 250,
                  outline: 'none',
                  backdropFilter: 'var(--glass-blur-sm)',
                  WebkitBackdropFilter: 'var(--glass-blur-sm)'
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Get free key</a>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={loadDailyBrief} disabled={briefLoading} style={{ fontSize: 12 }}>
              {briefLoading ? '⏳' : '🌅'} Daily Brief
            </button>
            <button className="btn btn-ghost" onClick={clearCurrentChat} style={{ fontSize: 12 }}>🗑️ Reset Chat</button>
          </div>
        </div>

        {dailyBrief && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(139,92,246,0.06))',
            border: '1px solid rgba(0,212,255,0.2)', borderRadius: 'var(--radius)',
            padding: '16px 20px', marginBottom: 14, animation: 'fadeUp 0.4s ease', position: 'relative'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>✦ Your Daily Brief</div>
            <Markdown text={dailyBrief} />
            <button onClick={() => setDailyBrief(null)} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-card)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            marginBottom: 14,
            minHeight: 0,
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {messages.length <= 1 && (
            <div style={{ animation: 'fadeUp 0.5s ease' }}>
              <div style={{ textAlign: 'center', padding: '20px 0 24px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✦</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {profile ? `Hello, ${profile.name || 'there'}!` : 'Hello!'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                  Your AI health assistant with full access to your profile, health logs, goals{location?.city ? `, and your location in ${location.city}` : ''}.
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Quick prompts</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {QUICK_PROMPTS.slice(0, 8).map(qp => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.text)}
                    disabled={sending}
                    style={{
                      padding: '10px 14px', border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                      color: 'var(--text-secondary)', fontSize: 13, textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-main)', fontWeight: 500
                    }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} style={{ animation: 'fadeUp 0.3s ease' }}>
              <MessageBubble msg={msg} profile={profile} isStreaming={false} />
            </div>
          ))}

          {typing && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 4, flexShrink: 0 }}>
          {QUICK_PROMPTS.map(qp => (
            <button
              key={qp.label}
              className="btn btn-ghost"
              onClick={() => sendMessage(qp.text)}
              disabled={sending}
              style={{ fontSize: 11, padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            background: 'var(--gradient-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 8px 8px 18px',
            alignItems: 'flex-end',
            boxShadow: 'var(--shadow-card)',
            flexShrink: 0,
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={location?.city ? `Ask about your health in ${location.city}...` : 'Ask anything about your health, sleep, diet, fitness, goals...'}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px';
            }}
            onKeyDown={handleKeyDown}
            disabled={sending}
            style={{
              flex: 1, border: 'none', background: 'transparent', resize: 'none',
              fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', outline: 'none',
              minHeight: 42, maxHeight: 140, padding: '10px 0', fontFamily: 'var(--font-main)'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={sending || !input.trim()}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: input.trim() && !sending ? 'var(--gradient-accent)' : 'var(--border)',
              color: input.trim() && !sending ? '#000' : 'var(--text-muted)',
              fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: 14,
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', flexShrink: 0,
              boxShadow: input.trim() && !sending ? '0 0 16px rgba(0,212,255,0.3)' : 'none'
            }}
          >
            {sending ? '⏳' : '➤'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, flexShrink: 0 }}>
          Enter to send · Shift+Enter for new line ·{' '}
          <span style={{ color: 'var(--accent-cyan)' }}>
            AI reads your real health data{location?.city ? ` · in ${location.city}` : ''}
          </span>
        </div>
      </section>
    </div>
  );
}
