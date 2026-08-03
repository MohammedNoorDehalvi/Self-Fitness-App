import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Overview from './components/Dashboard/Overview';
import HealthTracker from './components/HealthTracker/HealthTracker';
import AIAssistant from './components/AIAssistant/AIAssistant';
import RoutineAnalyzer from './components/RoutineAnalyzer/RoutineAnalyzer';
import Insights from './components/Insights/Insights';
import Profile from './components/Profile/Profile';
import Goals from './components/Goals/Goals';
import api from './utils/api';
import DotParticleCanvas from './components/DotParticleCanvas';
import SmoothFollower from './components/SmoothFollower';

// ── Toast notification component ──
const ToastContainer = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <div key={t.id} className={`toast ${t.type}`}>
        <strong>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</strong>
        {' '}{t.message}
      </div>
    ))}
  </div>
);

// ── Hosted Warning Modal ──
const HostedWarningModal = ({ onAcknowledge }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 99999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
  }}>
    <div className="card fade-in" style={{ maxWidth: 480, margin: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: 'var(--accent-amber)' }}>
        Data Loss Warning
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 12, lineHeight: 1.6 }}>
        Warning: This application is intended for local system hosting.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 12, lineHeight: 1.6 }}>
        If you are using a hosted version, please be aware that all data will be lost when you refresh or close the application.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
        This hosted version is for demonstration purposes only.
      </p>
      <button className="btn btn-primary" onClick={onAcknowledge} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
        I Understand
      </button>
    </div>
  </div>
);

export default function App() {
  const [activePage, setActivePage] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [streaks, setStreaks] = useState({ currentStreak: 0, longestStreak: 0, totalLoggedDays: 0 });
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(() => !sessionStorage.getItem('hosted_warning_acknowledged'));

  const acknowledgeWarning = () => {
    sessionStorage.setItem('hosted_warning_acknowledged', 'true');
    setShowWarning(false);
  };

  // ── Toast helper ──
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Load profile and streaks on mount ──
  useEffect(() => {
    const init = async () => {
      try {
        const [profileData, streakData] = await Promise.all([
          api.getProfile(),
          api.getStreaks()
        ]);
        if (profileData) setProfile(profileData);
        if (streakData) setStreaks(streakData);
      } catch (err) {
        console.warn('Init error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Profile update handler ──
  const handleProfileSave = async (profileData) => {
    try {
      const res = await api.saveProfile(profileData);
      setProfile(res.profile);
      toast('Profile saved successfully!', 'success');
    } catch (err) {
      toast(`Failed to save profile: ${err.message}`, 'error');
    }
  };

  // ── After health log saved, refresh streaks ──
  const handleLogSaved = async (data) => {
    if (data?.streaks) setStreaks(data.streaks);
    // Also update profile weight if weight was logged
    if (data?.log?.weight && profile) {
      setProfile(prev => ({ ...prev, weight: data.log.weight }));
    }
    toast('Health data logged! 💪', 'success');
  };

  const pages = {
    overview: <Overview profile={profile} streaks={streaks} onNavigate={setActivePage} toast={toast} />,
    tracker: <HealthTracker profile={profile} onLogSaved={handleLogSaved} toast={toast} />,
    insights: <Insights profile={profile} onNavigate={setActivePage} toast={toast} />,
    routine: <RoutineAnalyzer profile={profile} toast={toast} />,
    assistant: <AIAssistant profile={profile} toast={toast} />,
    goals: <Goals profile={profile} toast={toast} />,
    profile: <Profile profile={profile} onSave={handleProfileSave} toast={toast} />
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading VitaAI...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {showWarning && <HostedWarningModal onAcknowledge={acknowledgeWarning} />}
      <div className="app-layout">
        <ToastContainer toasts={toasts} />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 49, display: 'none'
            }}
          />
        )}

        <Sidebar
          activePage={activePage}
          onNavigate={(page) => { setActivePage(page); setSidebarOpen(false); }}
          profile={profile}
          streaks={streaks}
        />

        <main className="main-content">
          {/* Mobile header */}
          <div style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }} className="mobile-header">
            <h1 style={{ fontSize: 20, fontWeight: 700, background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VitaAI</h1>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn btn-ghost" style={{ padding: '8px 12px' }}>☰</button>
          </div>

          {/* Show profile setup prompt if no profile */}
          {!profile && activePage !== 'profile' && (
            <div className="alert alert-info fade-in" style={{ marginBottom: 24 }}>
              <div className="alert-title">👋 Welcome to VitaAI!</div>
              <div className="alert-detail">Set up your profile to get personalized health insights and AI recommendations.</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 12, fontSize: 12, padding: '6px 16px' }}
                onClick={() => setActivePage('profile')}
              >
                Set Up Profile →
              </button>
            </div>
          )}

          <div className="fade-in" key={activePage}>
            {pages[activePage] || pages.overview}
          </div>
        </main>
      </div>

      <DotParticleCanvas
        className="app-particle-background"
        backgroundColor="transparent"
        particleColor="0, 212, 255"
      />
      <SmoothFollower />
    </div>
  );
}
