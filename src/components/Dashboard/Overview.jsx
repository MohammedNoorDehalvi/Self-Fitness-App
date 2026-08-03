import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import api from '../../utils/api';

const isObject = (value) => value !== null && typeof value === 'object';

const toDisplayText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ');
  if (isObject(value)) {
    return toDisplayText(
      value.text ??
      value.message ??
      value.title ??
      value.action ??
      value.detail ??
      value.fix ??
      value.name ??
      value.label ??
      value.value ??
      value.summary ??
      value.type ??
      JSON.stringify(value)
    );
  }
  return String(value);
};

const normalizeAlertItem = (item, fallbackIcon = 'ℹ️') => {
  const src = isObject(item) ? item : { message: item };
  return {
    type: toDisplayText(src.type),
    severity: toDisplayText(src.severity),
    icon: toDisplayText(src.icon || fallbackIcon) || fallbackIcon,
    title: toDisplayText(src.title || src.name || src.label || ''),
    message: toDisplayText(src.message || src.detail || src.summary || src.title || ''),
    action: toDisplayText(src.action || src.fix || ''),
  };
};

// ── Custom tooltip for charts ──
const ChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}{unit || ''}
        </div>
      ))}
    </div>
  );
};

// ── Health score ring ──
const HealthScoreRing = ({ score }) => {
  const r = 52, circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#00ff88' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 8px ${color})` }}
        />
        <text
          x="65" y="70"
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-primary)" fontSize="26" fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          style={{ transform: 'rotate(90deg) translateX(-130px)' }}
        >
          {score}
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Health Score</div>
      </div>
    </div>
  );
};

// ── Mini stat card ──
const StatCard = ({ icon, label, value, unit, change, color }) => (
  <div className="card" style={{ textAlign: 'center', padding: 18 }}>
    <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
    <div style={{
      fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)',
      color: color || 'var(--text-primary)', lineHeight: 1.1
    }}>
      {value !== null && value !== undefined ? value : '—'}
      {value !== null && value !== undefined && <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}> {unit}</span>}
    </div>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', margin: '4px 0' }}>
      {label}
    </div>
    {change !== undefined && change !== null && (
      <div style={{ fontSize: 12, fontWeight: 600, color: change > 0 ? 'var(--accent-green)' : change < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
        {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}%
      </div>
    )}
  </div>
);

export default function Overview({ profile, streaks, onNavigate, toast }) {
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [aiDashboard, setAiDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sum, ins, dash] = await Promise.all([
          api.getSummary(),
          api.getSuggestions(),
          api.getDashboardAI()
        ]);
        setSummary(sum);
        setInsights(ins?.analysis ? ins.analysis : ins);
        setAiDashboard(dash);
      } catch (e) {
        console.warn('Overview load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Format chart data
  const makeChartData = (history, key, label) => {
    if (!history?.length) return [];
    return history.slice(-14).map(entry => ({
      date: format(parseISO(entry.date), 'MMM d'),
      [label]: entry[key] || 0
    }));
  };

  if (loading) return (
    <div className="loading-container">
      <div className="spinner" />
      <span>Loading dashboard...</span>
    </div>
  );

  const s7 = summary?.last7Days || {};
  const weightData = makeChartData(summary?.weightHistory, 'weight', 'Weight');
  const sleepData = makeChartData(summary?.sleepHistory, 'sleep', 'Sleep');
  const waterData = makeChartData(summary?.waterHistory, 'water', 'Water');
  const moodData = makeChartData(summary?.moodHistory, 'mood', 'Mood');

  const allChartData = summary?.sleepHistory?.slice(-14).map((entry, i) => ({
    date: format(parseISO(entry.date), 'MMM d'),
    Sleep: entry.sleep || 0,
    Water: summary.waterHistory?.[summary.waterHistory.length - 14 + i]?.water || 0
  })) || [];

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h1 className="section-title">
          {profile ? `Good day, ${profile.name || 'there'}! 👋` : 'Health Overview'}
        </h1>
        <p className="section-subtitle">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>


      {aiDashboard?.overview && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🤖 AI Overview</div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{toDisplayText(aiDashboard.overview.summary)}</div>
            <div>• Score: {toDisplayText(aiDashboard.overview.score)}</div>
            <div>• Priority: {toDisplayText((aiDashboard.overview.priorities || [])[0] || 'Continue logging to refine guidance.')}</div>
            <div>• Warnings: {aiDashboard.overview.warnings?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Top row — score + streak + quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Health score */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HealthScoreRing score={insights?.score || 0} />
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <StatCard icon="😴" label="Avg Sleep" value={s7.avgSleep || null} unit="hrs"
            color={s7.avgSleep >= 7 ? 'var(--accent-green)' : s7.avgSleep > 0 ? 'var(--accent-amber)' : undefined} />
          <StatCard icon="💧" label="Avg Water" value={s7.avgWater || null} unit="L"
            color={s7.avgWater >= 2 ? 'var(--accent-cyan)' : s7.avgWater > 0 ? 'var(--accent-amber)' : undefined} />
          <StatCard icon="⚖️" label="Weight" value={s7.avgWeight || (profile?.weight)} unit="kg" />
          <StatCard icon="🏃" label="Active Days" value={s7.activeDays ?? null} unit="/7"
            color={s7.activeDays >= 5 ? 'var(--accent-green)' : 'var(--text-primary)'} />
          <StatCard icon="🔥" label="Exercise" value={s7.totalExerciseMin || null} unit="min" />
          <StatCard icon="😊" label="Avg Mood" value={s7.avgMood || null} unit="/10"
            color={s7.avgMood >= 7 ? 'var(--accent-green)' : s7.avgMood >= 5 ? 'var(--accent-amber)' : undefined} />
        </div>
      </div>

      {/* Streak banner */}
      {streaks?.currentStreak > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(239,68,68,0.05) 100%)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 'var(--radius)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20
        }}>
          <div>
            <span style={{ fontSize: 24 }}>{streaks.currentStreak >= 7 ? '🔥' : '⚡'}</span>
            <span style={{ fontWeight: 700, fontSize: 16, marginLeft: 10, color: 'var(--accent-amber)' }}>
              {streaks.currentStreak}-Day Streak
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 10, fontSize: 13 }}>
              Keep it up! Best: {streaks.longestStreak} days
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {streaks.totalLoggedDays} total days logged
          </div>
        </div>
      )}

      {/* Warnings & insights */}
      {insights && (insights.warnings?.length > 0 || insights.suggestions?.length > 0 || insights.insights?.length > 0) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🤖 AI Health Alerts</div>

          {insights.warnings?.slice(0, 3).map((w, i) => (
            <div key={i} className={`alert alert-${w.severity === 'critical' ? 'danger' : w.severity === 'high' ? 'danger' : 'warn'}`}>
              <div className="alert-title">{toDisplayText(w.icon)} {toDisplayText(w.title)}</div>
              <div className="alert-detail">{toDisplayText(w.message)}</div>
              <div className="alert-action">💡 {toDisplayText(w.action)}</div>
            </div>
          ))}

          {insights.suggestions?.slice(0, 2).map((s, i) => (
            <div key={i} className="alert alert-warn">
              <div className="alert-title">{toDisplayText(s.icon)} {toDisplayText(s.title)}</div>
              <div className="alert-detail">{toDisplayText(s.message)}</div>
              <div className="alert-action">💡 {toDisplayText(s.action)}</div>
            </div>
          ))}

          {insights.insights?.slice(0, 2).map((ins, i) => (
            <div key={i} className="alert alert-success">
              <div className="alert-title">{toDisplayText(ins.icon)} {toDisplayText(ins.title)}</div>
              <div className="alert-detail">{toDisplayText(ins.message)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Sleep chart */}
        <div className="card">
          <div className="card-title">😴 Sleep (14 days)</div>
          {sleepData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={sleepData}>
                <defs>
                  <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<ChartTooltip unit="h" />} />
                {/* 7h recommended line */}
                <Line dataKey={() => 7} stroke="rgba(0,255,136,0.3)" strokeDasharray="4 4" dot={false} name="Target" />
                <Area type="monotone" dataKey="Sleep" stroke="#8b5cf6" fill="url(#sleepGrad)" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <div style={{ fontSize: 30 }}>😴</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start logging sleep to see trends</p>
            </div>
          )}
        </div>

        {/* Weight chart */}
        <div className="card">
          <div className="card-title">⚖️ Weight Trend (30 days)</div>
          {weightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip unit="kg" />} />
                <Area type="monotone" dataKey="Weight" stroke="#00d4ff" fill="url(#weightGrad)" strokeWidth={2} dot={{ fill: '#00d4ff', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <div style={{ fontSize: 30 }}>⚖️</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log your weight daily to see trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Water & mood row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Water */}
        <div className="card">
          <div className="card-title">💧 Water Intake (14 days)</div>
          {waterData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={waterData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<ChartTooltip unit="L" />} />
                <Bar dataKey="Water" fill="#00d4ff" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div style={{ fontSize: 28 }}>💧</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log water intake to track hydration</p>
            </div>
          )}
        </div>

        {/* Mood */}
        <div className="card">
          <div className="card-title">😊 Mood Tracking</div>
          {moodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis domain={[1, 10]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<ChartTooltip unit="/10" />} />
                <Line type="monotone" dataKey="Mood" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 24 }}>
              <div style={{ fontSize: 28 }}>😊</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log your mood (1-10) daily</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-title">⚡ Quick Actions</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: '📋 Log Today', page: 'tracker', style: 'btn-primary' },
            { label: '🤖 Ask AI', page: 'assistant', style: 'btn-ghost' },
            { label: '📊 View Insights', page: 'insights', style: 'btn-ghost' },
            { label: '🔄 Analyze Routine', page: 'routine', style: 'btn-ghost' },
            { label: '🎯 My Goals', page: 'goals', style: 'btn-ghost' },
          ].map(a => (
            <button key={a.page} className={`btn ${a.style}`} onClick={() => onNavigate(a.page)}
              style={{ fontSize: 13 }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}