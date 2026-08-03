import React, { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
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
    ctaLabel: toDisplayText(src.ctaLabel || src.buttonLabel || ''),
    ctaTarget: toDisplayText(src.ctaTarget || ''),
    ctaPrompt: toDisplayText(src.ctaPrompt || '')
  };
};
const MetricRow = ({ label, value, unit, target, color, icon, description }) => {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
            {description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{description}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
            {value !== null && value !== undefined ? value : '—'}
          </span>
          {unit && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> {unit}</span>}
          {target && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Target: {target}{unit}</div>}
        </div>
      </div>
      {target > 0 && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{
            width: `${pct}%`,
            background: pct >= 100 ? 'var(--accent-green)' : pct >= 75 ? color : pct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)'
          }} />
        </div>
      )}
    </div>
  );
};

const BMIGauge = ({ bmi, category }) => {
  const segments = [
    { label: 'Underweight', range: [0, 18.5], color: '#3b82f6' },
    { label: 'Normal', range: [18.5, 25], color: '#22c55e' },
    { label: 'Overweight', range: [25, 30], color: '#f59e0b' },
    { label: 'Obese', range: [30, 40], color: '#ef4444' },
  ];

  const clampedBMI = Math.min(40, Math.max(10, bmi));
  const pct = ((clampedBMI - 10) / 30) * 100;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        {segments.map(s => (
          <div key={s.label} style={{
            flex: (s.range[1] - s.range[0]),
            background: s.color,
            opacity: category?.label === s.label ? 1 : 0.3
          }} />
        ))}
      </div>
      <div style={{
        position: 'relative', height: 12,
        marginBottom: 4
      }}>
        <div style={{
          position: 'absolute',
          left: `${pct}%`, transform: 'translateX(-50%)',
          fontSize: 16
        }}>▲</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        {segments.map(s => <span key={s.label}>{s.range[0]}</span>)}
        <span>40+</span>
      </div>
    </div>
  );
};

export default function Insights({ profile, toast, onNavigate }) {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [insData, logData] = await Promise.all([
          api.getInsights(),
          api.getLogs(30)
        ]);
        setData(insData?.analysis ? insData.analysis : insData);
        setLogs(logData);
      } catch (e) {
        console.warn('Insights load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /><span>Crunching your health data...</span></div>;
  if (!profile) return (
    <div className="card"><div className="empty-state">
      <div className="empty-state-icon">📊</div>
      <h3>Profile Required</h3>
      <p>Set up your profile to unlock health insights, BMI analysis, and personalized recommendations.</p>
    </div></div>
  );

  const { biometrics, analysis, trends, streaks, achievements } = data || {};

  // Radar data for health score breakdown
  const radarData = [
    { metric: 'Sleep', value: analysis?.warnings?.some(w => w.type === 'sleep') ? 40 : analysis?.insights?.some(i => i.type === 'sleep') ? 90 : 65 },
    { metric: 'Hydration', value: analysis?.warnings?.some(w => w.type === 'hydration') ? 35 : 80 },
    { metric: 'Exercise', value: analysis?.warnings?.some(w => w.type === 'exercise') ? 30 : analysis?.insights?.some(i => i.type === 'exercise') ? 90 : 60 },
    { metric: 'Nutrition', value: analysis?.warnings?.some(w => w.type === 'nutrition') ? 40 : 70 },
    { metric: 'BMI', value: biometrics?.bmiCategory?.risk === 'low' ? 90 : biometrics?.bmiCategory?.risk === 'medium' ? 60 : 30 },
    { metric: 'Consistency', value: Math.min(100, (streaks?.totalLoggedDays || 0) * 10) },
  ];

  // Chart data
  const last30 = logs.slice(-30);
  const weightChartData = last30.filter(l => l.weight).map(l => ({
    date: format(parseISO(l.date), 'MMM d'),
    weight: l.weight
  }));
  const sleepChartData = last30.filter(l => l.sleep > 0).map(l => ({
    date: format(parseISO(l.date), 'MMM d'),
    sleep: l.sleep,
    target: 7.5
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)' }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>)}
      </div>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">📊 Health Insights</h1>
        <p className="section-subtitle">Deep analysis of your health data, trends, and biometrics</p>
      </div>

      {/* Health Score + Radar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Overall score */}
        <div className="card">
          <div className="card-title">🏆 Overall Health Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              fontSize: 72, fontWeight: 900, fontFamily: 'var(--font-mono)',
              lineHeight: 1,
              color: analysis?.score >= 80 ? '#00ff88' : analysis?.score >= 60 ? '#f59e0b' : '#ef4444',
              textShadow: `0 0 30px ${analysis?.score >= 80 ? '#00ff88' : analysis?.score >= 60 ? '#f59e0b' : '#ef4444'}40`
            }}>
              {analysis?.score || 0}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {analysis?.score >= 80 ? 'Excellent' : analysis?.score >= 60 ? 'Good' : analysis?.score >= 40 ? 'Fair' : 'Needs Work'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Based on last 7 days of logged data</div>
              <div style={{ marginTop: 12 }}>
                <div className="progress-bar-container" style={{ height: 10 }}>
                  <div className="progress-bar-fill" style={{
                    width: `${analysis?.score || 0}%`,
                    background: analysis?.score >= 80 ? 'var(--accent-green)' : analysis?.score >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)'
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Radar chart */}
        <div className="card">
          <div className="card-title">🕸️ Health Dimension Radar</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Radar name="Score" dataKey="value" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BMI Analysis */}
      {biometrics && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">⚖️ BMI & Body Composition Analysis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 20 }}>
            {[
              { label: 'BMI', value: biometrics.bmi, color: biometrics.bmiCategory?.color, unit: '', desc: biometrics.bmiCategory?.label },
              { label: 'BMR', value: biometrics.bmr, color: 'var(--accent-cyan)', unit: 'kcal', desc: 'Base metabolic rate' },
              { label: 'TDEE', value: biometrics.tdee, color: 'var(--accent-purple)', unit: 'kcal', desc: 'Daily energy need' },
              { label: 'Water Need', value: biometrics.dailyWaterNeed, color: '#3b82f6', unit: 'L/day', desc: 'Hydration target' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{m.unit}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</div>
              </div>
            ))}
          </div>

          <BMIGauge bmi={biometrics.bmi} category={biometrics.bmiCategory} />

          {biometrics.idealWeightRange && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Ideal weight range for your height: </span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                {biometrics.idealWeightRange.min} – {biometrics.idealWeightRange.max} kg
              </span>
              <span style={{ color: 'var(--text-muted)' }}> (ideal: {biometrics.idealWeightRange.ideal} kg)</span>
            </div>
          )}

          {/* Macro targets */}
          {biometrics.macroTargets && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Daily Macro Targets
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {[
                  { label: 'Calories', value: biometrics.macroTargets.calories, unit: 'kcal', color: '#f59e0b' },
                  { label: 'Protein', value: biometrics.macroTargets.protein, unit: 'g', color: '#ef4444' },
                  { label: 'Carbs', value: biometrics.macroTargets.carbs, unit: 'g', color: '#3b82f6' },
                  { label: 'Fat', value: biometrics.macroTargets.fat, unit: 'g', color: '#8b5cf6' },
                  { label: 'Fiber', value: biometrics.macroTargets.fiber, unit: 'g', color: '#00ff88' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.unit}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trend analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Weight trend */}
        <div className="card">
          <div className="card-title">📉 Weight Trend (30 days)</div>
          {weightChartData.length >= 2 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weightChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="weight" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff', r: 3 }} name="Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
              {trends?.weight && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                  Weekly change: {' '}
                  <span style={{ color: Math.abs(trends.weeklyWeightChange) > 1 ? 'var(--accent-amber)' : 'var(--accent-green)', fontWeight: 600 }}>
                    {trends.weeklyWeightChange > 0 ? '+' : ''}{trends.weeklyWeightChange} kg/week
                  </span>
                  {' '} • R²: {trends.weightRegression?.r2}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <div style={{ fontSize: 30 }}>📊</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log weight for 2+ days to see trend</p>
            </div>
          )}
        </div>

        {/* Sleep trend */}
        <div className="card">
          <div className="card-title">😴 Sleep Trend (30 days)</div>
          {sleepChartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sleepChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={7.5} stroke="#00ff88" strokeDasharray="4 4" label={{ value: 'Target', fill: '#00ff88', fontSize: 10 }} />
                <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Sleep (hrs)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 30 }}>
              <div style={{ fontSize: 30 }}>😴</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log sleep for 2+ days to see trend</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly comparison */}
      {(trends?.sleep || trends?.water || trends?.weight) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">📆 Week-over-Week Comparison</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Sleep', data: trends?.sleep, unit: 'hrs', icon: '😴', color: '#8b5cf6' },
              { label: 'Water', data: trends?.water, unit: 'L', icon: '💧', color: '#00d4ff' },
              { label: 'Weight', data: trends?.weight, unit: 'kg', icon: '⚖️', color: '#f59e0b' },
            ].map(m => m.data && (
              <div key={m.label} style={{ background: 'var(--bg-input)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{m.label}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>This week</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.data.thisWeekAvg}<span style={{ fontSize: 11 }}> {m.unit}</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last week</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>{m.data.lastWeekAvg}<span style={{ fontSize: 11 }}> {m.unit}</span></div>
                  </div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: m.data.delta > 0 ? 'var(--accent-green)' : m.data.delta < 0 ? 'var(--accent-red)' : 'var(--text-muted)'
                }}>
                  {m.data.delta > 0 ? '↑' : m.data.delta < 0 ? '↓' : '→'}
                  {' '}{Math.abs(m.data.delta)} {m.unit}
                  {' '}({m.data.percentChange > 0 ? '+' : ''}{m.data.percentChange}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">🏆 Achievements Earned</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {achievements.map(a => (
              <div key={a.id} style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 10, padding: '10px 16px', textAlign: 'center'
              }}>
                <div style={{ fontSize: 22 }}>{a.label.split(' ')[0]}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-amber)', marginTop: 4 }}>
                  {a.label.slice(a.label.indexOf(' ') + 1)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Alerts summary */}
      {analysis && (analysis.warnings?.length > 0 || analysis.suggestions?.length > 0) && (
        <div className="card">
          <div className="card-title">🤖 AI Analysis Summary</div>
          {analysis.warnings?.map((w, i) => (
            <div key={i} className={`alert alert-${w.severity === 'critical' || w.severity === 'high' ? 'danger' : 'warn'}`}>
              <div className="alert-title">{toDisplayText(w.icon)} {toDisplayText(w.title)}</div>
              <div className="alert-detail">{toDisplayText(w.message)}</div>
              <div className="alert-action">💡 {toDisplayText(w.action)}</div>
              {w.ctaLabel && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 10, padding: '8px 12px', fontSize: 12 }}
                  onClick={() => onNavigate?.(w.ctaTarget || 'assistant')}
                >
                  {toDisplayText(w.ctaLabel)}
                </button>
              )}
            </div>
          ))}
          {analysis.suggestions?.map((s, i) => (
            <div key={i} className="alert alert-info">
              <div className="alert-title">{toDisplayText(s.icon)} {toDisplayText(s.title)}</div>
              <div className="alert-detail">{toDisplayText(s.message)}</div>
              <div className="alert-action">💡 {toDisplayText(s.action)}</div>
              {s.ctaLabel && (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 10, padding: '8px 12px', fontSize: 12 }}
                  onClick={() => onNavigate?.(s.ctaTarget || 'assistant')}
                >
                  {toDisplayText(s.ctaLabel)}
                </button>
              )}
            </div>
          ))}
          {analysis.insights?.map((ins, i) => (
            <div key={i} className="alert alert-success">
              <div className="alert-title">{toDisplayText(ins.icon)} {toDisplayText(ins.title)}</div>
              <div className="alert-detail">{toDisplayText(ins.message)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}