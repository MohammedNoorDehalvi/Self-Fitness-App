import React from 'react';

const NAV_ITEMS = [
  { id: 'overview',   icon: '⚡', label: 'Overview',         desc: 'Dashboard' },
  { id: 'tracker',    icon: '📋', label: 'Health Tracker',   desc: 'Log daily data' },
  { id: 'insights',   icon: '📊', label: 'Insights',         desc: 'Analytics & trends' },
  { id: 'routine',    icon: '🔄', label: 'Routine Analyzer', desc: 'AI routine review' },
  { id: 'assistant',  icon: '🤖', label: 'AI Assistant',     desc: 'Health chatbot' },
  { id: 'goals',      icon: '🎯', label: 'Goals',            desc: 'Track targets' },
  { id: 'profile',    icon: '👤', label: 'Profile',          desc: 'Your settings' },
];

export default function Sidebar({ activePage, onNavigate, profile, streaks }) {
  const streakFire = streaks?.currentStreak >= 7 ? '🔥' : streaks?.currentStreak >= 3 ? '⚡' : '•';

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: 260,
      background: 'var(--gradient-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      overflow: 'hidden',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)'
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          background: 'var(--gradient-accent)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 4
        }}>
          VitaAI
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Health Assistant
        </div>
      </div>

      {/* Profile mini-card */}
      {profile && (
        <div
          onClick={() => onNavigate('profile')}
          style={{
            margin: '16px 12px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.16)',
            backdropFilter: 'var(--glass-blur-sm)',
            WebkitBackdropFilter: 'var(--glass-blur-sm)'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--gradient-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#000'
            }}>
              {(profile.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile.name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {profile.age}y • {profile.weight}kg • {profile.gender}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streak indicator */}
      {streaks?.currentStreak > 0 && (
        <div style={{
          margin: '0 12px 12px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14)',
          backdropFilter: 'var(--glass-blur-sm)',
          WebkitBackdropFilter: 'var(--glass-blur-sm)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--accent-amber)', fontWeight: 600 }}>
            {streakFire} {streaks.currentStreak}-day streak
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Best: {streaks.longestStreak}
          </div>
        </div>
      )}

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '11px 14px',
                marginBottom: 3,
                borderRadius: 12,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
                background: isActive
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.08)',
                borderColor: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.14)',
                boxShadow: isActive ? '0 10px 28px rgba(0,0,0,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                backdropFilter: 'var(--glass-blur-sm)',
                WebkitBackdropFilter: 'var(--glass-blur-sm)'
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.16)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
            >
              <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>{item.icon}</span>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isActive ? '#08111f' : 'var(--text-primary)',
                  transition: 'color 0.15s'
                }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 10, color: isActive ? 'rgba(8,17,31,0.62)' : 'var(--text-muted)', marginTop: 1 }}>
                  {item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-muted)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        <div>VitaAI v1.0 • Local Data</div>
        <div style={{ marginTop: 2, color: 'var(--text-muted)', opacity: 0.6 }}>All data stored privately</div>
      </div>
    </nav>
  );
}
