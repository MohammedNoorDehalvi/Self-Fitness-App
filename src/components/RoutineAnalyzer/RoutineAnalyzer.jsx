import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';

const SAMPLE_ROUTINES = [
  {
    label: 'Unhealthy routine',
    text: `7:00 AM - Wake up feeling tired
7:30 AM - Skip breakfast, just coffee
9:00 AM - Start work
1:00 PM - Skip lunch, still working
3:00 PM - Energy drink and chips as snack
6:00 PM - Still working, skip dinner
9:00 PM - Finally eat a big meal
11:00 PM - Watch Netflix
1:00 AM - Scroll phone in bed
2:00 AM - Try to sleep`
  },
  {
    label: 'Moderate routine',
    text: `6:30 AM - Wake up
7:00 AM - Breakfast (toast and eggs)
8:00 AM - Commute to work
9:00 AM - Start work
1:00 PM - Lunch break
6:00 PM - Leave office
7:00 PM - Walk for 20 minutes
7:30 PM - Dinner
9:00 PM - Watch TV
10:30 PM - Sleep`
  }
];

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

const normalizeListItem = (item, fallback = {}) => {
  const source = isObject(item) ? item : { message: item };
  return { ...fallback, ...source };
};

const normalizeAnalysis = (analysis) => {
  if (!isObject(analysis)) return null;

  const positives = Array.isArray(analysis.positives)
    ? analysis.positives.map((item) => {
        const src = normalizeListItem(item);
        return {
          icon: toDisplayText(src.icon || '✅') || '✅',
          message: toDisplayText(src.message || src.title || src.detail || src.action || src.fix || src)
        };
      }).filter((item) => item.message)
    : [];

  const issues = Array.isArray(analysis.issues)
    ? analysis.issues.map((item) => {
        const src = normalizeListItem(item);
        return {
          severity: ['low', 'medium', 'high'].includes(src.severity) ? src.severity : 'medium',
          icon: toDisplayText(src.icon || '⚠️') || '⚠️',
          title: toDisplayText(src.title || src.message || src.detail || 'Issue'),
          detail: toDisplayText(src.detail || src.message || src.title || ''),
          fix: toDisplayText(src.fix || src.action || src.message || '')
        };
      }).filter((item) => item.title || item.detail || item.fix)
    : [];

  const suggestions = Array.isArray(analysis.suggestions)
    ? analysis.suggestions.map((item) => {
        const src = normalizeListItem(item);
        return {
          icon: toDisplayText(src.icon || '💡') || '💡',
          title: toDisplayText(src.title || src.message || src.detail || 'Suggestion'),
          detail: toDisplayText(src.detail || src.message || src.title || ''),
          fix: toDisplayText(src.fix || src.action || src.message || '')
        };
      }).filter((item) => item.title || item.detail || item.fix)
    : [];

  const activities = Array.isArray(analysis.activities)
    ? analysis.activities.map((item) => {
        const src = normalizeListItem(item);
        return {
          line: toDisplayText(src.line || src.text || src.title || src.message || ''),
          category: ['sleep', 'exercise', 'meal', 'work', 'leisure', 'selfCare', 'commute', 'other'].includes(src.category) ? src.category : 'other',
          hour: Number.isFinite(Number(src.hour)) ? Number(src.hour) : null,
          priority: [1, 2, 3, 4, 5].includes(Number(src.priority)) ? Number(src.priority) : 3
        };
      })
    : [];

  const actionPlan = Array.isArray(analysis.actionPlan)
    ? analysis.actionPlan.map((item) => {
        const src = normalizeListItem(item);
        return {
          time: toDisplayText(src.time || src.title || src.icon || 'Plan'),
          action: toDisplayText(src.action || src.message || src.detail || src.title || src.fix || src)
        };
      }).filter((item) => item.time || item.action)
    : [];

  return {
    ...analysis,
    routineScore: Number.isFinite(Number(analysis.routineScore)) ? Number(analysis.routineScore) : Number(analysis.score) || 0,
    summary: toDisplayText(analysis.summary),
    positives,
    issues,
    suggestions,
    activities,
    actionPlan
  };
};

const normalizeRoutineRecord = (record) => {
  if (!isObject(record)) return record;
  return {
    ...record,
    analysis: normalizeAnalysis(record.analysis) || record.analysis
  };
};

const ScoreGauge = ({ score }) => {
  const color = score >= 80 ? '#00ff88' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Moderate' : score >= 40 ? 'Needs Work' : 'Unhealthy';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: `rgba(${score >= 80 ? '0,255,136' : score >= 60 ? '245,158,11' : '239,68,68'},0.08)`,
      border: `1px solid ${color}40`,
      borderRadius: 'var(--radius)',
      padding: '16px 20px'
    }}>
      <div style={{
        fontSize: 42,
        fontWeight: 800,
        fontFamily: 'var(--font-mono)',
        color,
        textShadow: `0 0 20px ${color}40`
      }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{label} Routine</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Routine health score out of 100</div>
        <div style={{ marginTop: 8 }}>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${score}%`, background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RoutineAnalyzer({ profile, toast }) {
  const [routineText, setRoutineText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('analyze');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    api.getRoutineHistory()
      .then((items) => setHistory(Array.isArray(items) ? items.map(normalizeRoutineRecord) : []))
      .catch(console.warn);
  }, []);

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsText(file);
  });

  const normalizeUploadedRoutine = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') return parsed;
      if (parsed?.routineText) return String(parsed.routineText);
      if (parsed?.text) return String(parsed.text);
      if (Array.isArray(parsed?.routine)) return parsed.routine.join('\n');
    } catch {
      // plain text is fine
    }

    return trimmed;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const normalized = normalizeUploadedRoutine(text);
      setFileName(file.name);
      setRoutineText(normalized);
      toast(`Loaded routine from ${file.name}`, 'success');
    } catch (err) {
      toast(err.message || 'Failed to load file', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!routineText.trim() || routineText.length < 20) {
      toast('Please enter or upload a more detailed routine (at least a few activities)', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await api.analyzeRoutine(routineText);
      const normalized = normalizeRoutineRecord(data);
      setResult(normalized.analysis);
      setSelectedHistory(null);
      setHistory((h) => [normalized, ...h.slice(0, 9)]);
      toast(normalized.analysis?.aiMode === 'groq' ? 'AI routine analysis completed!' : 'Routine analyzed with fallback logic.', 'success');
    } catch (e) {
      toast(`Analysis failed: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const displayAnalysis = normalizeAnalysis(selectedHistory?.analysis || result);

  const routineMeta = useMemo(() => {
    if (!displayAnalysis) return null;
    return {
      mode: displayAnalysis.aiMode || 'unknown',
      model: displayAnalysis.aiModel || ''
    };
  }, [displayAnalysis]);

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">🔄 Routine Analyzer</h1>
        <p className="section-subtitle">Upload or paste your routine and get AI analysis with personalized fixes</p>
      </div>

      <div className="tab-group">
        <button className={`tab-btn ${activeTab === 'analyze' ? 'active' : ''}`} onClick={() => { setActiveTab('analyze'); setSelectedHistory(null); }}>
          🔍 Analyze Routine
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📅 Past Analyses ({history.length})
        </button>
        <button className={`tab-btn ${activeTab === 'optimal' ? 'active' : ''}`} onClick={() => setActiveTab('optimal')}>
          🌟 Optimal Schedule
        </button>
      </div>

      {activeTab === 'analyze' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title">📝 Your Daily Routine</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Upload a text file or paste your daily routine. Include wake time, meals, work, exercise, screen time, and bedtime.
              </p>

              <input
                type="file"
                accept=".txt,.md,.json,.csv,.log"
                onChange={handleFileUpload}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 12,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text)'
                }}
              />

              {fileName && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Loaded file: <strong>{fileName}</strong>
                </div>
              )}

              <textarea
                rows={14}
                placeholder={`Example:\n6:30 AM - Wake up\n7:00 AM - Breakfast\n9:00 AM - Office work\n1:00 PM - Lunch\n6:00 PM - Go to gym\n8:00 PM - Dinner\n10:00 PM - Read\n11:00 PM - Sleep`}
                value={routineText}
                onChange={(e) => setRoutineText(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8 }}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {SAMPLE_ROUTINES.map((sr) => (
                  <button
                    key={sr.label}
                    className="btn btn-ghost"
                    onClick={() => {
                      setFileName('');
                      setRoutineText(sr.text);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Try: {sr.label}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={loading || !routineText.trim()}
                style={{ width: '100%', marginTop: 14, padding: '13px' }}
              >
                {loading ? '🔍 Analyzing...' : '🤖 Analyze My Routine'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!displayAnalysis && !loading && (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🔄</div>
                  <h3>Ready to Analyze</h3>
                  <p>Upload a routine file or paste your routine on the left, then click Analyze to get AI feedback.</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="card">
                <div className="loading-container">
                  <div className="spinner" />
                  <span>Analyzing your routine...</span>
                </div>
              </div>
            )}

            {displayAnalysis && !loading && (
              <>
                <div className="card">
                  <div className="card-title">📊 Routine Score</div>
                  <ScoreGauge score={Number(displayAnalysis.routineScore) || 0} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                    {toDisplayText(displayAnalysis.summary)}
                  </div>
                  {routineMeta && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      Source: <strong>{routineMeta.mode}</strong>{routineMeta.model ? ` • ${routineMeta.model}` : ''}
                    </div>
                  )}
                </div>

                {displayAnalysis.issues?.length > 0 && (
                  <div className="card">
                    <div className="card-title">⚠️ Issues Found ({displayAnalysis.issues.length})</div>
                    {displayAnalysis.issues.map((issue, i) => (
                      <div key={i} className={`alert alert-${issue.severity === 'high' ? 'danger' : 'warn'}`}>
                        <div className="alert-title">{toDisplayText(issue.icon)} {toDisplayText(issue.title)}</div>
                        <div className="alert-detail">{toDisplayText(issue.detail)}</div>
                        <div className="alert-action">✅ Fix: {toDisplayText(issue.fix)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {displayAnalysis.suggestions?.length > 0 && (
                  <div className="card">
                    <div className="card-title">💡 Suggestions ({displayAnalysis.suggestions.length})</div>
                    {displayAnalysis.suggestions.map((s, i) => (
                      <div key={i} className="alert alert-info">
                        <div className="alert-title">{toDisplayText(s.icon)} {toDisplayText(s.title)}</div>
                        <div className="alert-detail">{toDisplayText(s.detail)}</div>
                        <div className="alert-action">💡 {toDisplayText(s.fix)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {displayAnalysis.positives?.length > 0 && (
                  <div className="card">
                    <div className="card-title">✅ What You're Doing Right</div>
                    {displayAnalysis.positives.map((p, i) => (
                      <div key={i} className="alert alert-success">
                        {toDisplayText(p.icon)} {toDisplayText(p.message)}
                      </div>
                    ))}
                  </div>
                )}

                {displayAnalysis.activities?.length > 0 && (
                  <div className="card">
                    <div className="card-title">📋 Detected Activities</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {displayAnalysis.activities.map((act, i) => {
                        const colors = {
                          sleep: '#8b5cf6',
                          exercise: '#00ff88',
                          meal: '#f59e0b',
                          work: '#3b82f6',
                          leisure: '#ec4899',
                          selfCare: '#00d4ff',
                          commute: '#6b7280',
                          other: '#4a5568'
                        };
                        const col = colors[act.category] || colors.other;
                        const text = toDisplayText(act.line);
                        return (
                          <span
                            key={i}
                            style={{
                              background: `${col}15`,
                              color: col,
                              border: `1px solid ${col}30`,
                              borderRadius: 999,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={text}
                          >
                            {act.hour !== null ? `${act.hour}:00 ` : ''}{text.slice(0, 30)}{text.length > 30 ? '…' : ''}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {displayAnalysis.actionPlan?.length > 0 && (
                  <div className="card">
                    <div className="card-title">🧭 Action Plan</div>
                    {displayAnalysis.actionPlan.map((step, i) => (
                      <div key={i} className="alert alert-info">
                        <div className="alert-title">{toDisplayText(step.time)}</div>
                        <div className="alert-detail">{toDisplayText(step.action)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>📅 Analysis History</div>
            {history.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>
                No analyses yet. Analyze your routine first!
              </div>
            ) : (
              history.map((h, i) => (
                <div
                  key={h.id || i}
                  onClick={() => { setSelectedHistory(h); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selectedHistory?.id === h.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                    border: `1px solid ${selectedHistory?.id === h.id ? 'rgba(0,212,255,0.3)' : 'transparent'}`,
                    marginBottom: 4,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => { if (selectedHistory?.id !== h.id) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                  onMouseLeave={(e) => { if (selectedHistory?.id !== h.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    Score {Number(h.analysis?.routineScore ?? h.analysis?.score ?? 0) || '--'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(h.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="card-title">🧠 Detailed Analysis</div>
            {selectedHistory ? (
              <>
                <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  {toDisplayText(selectedHistory.analysis?.summary)}
                </div>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  lineHeight: 1.7,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 14,
                  overflowX: 'auto'
                }}>
{JSON.stringify(selectedHistory.analysis, null, 2)}
                </pre>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
                Select an analysis from the left to inspect the full result.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'optimal' && (
        <div className="card">
          <div className="card-title">🌟 AI-Friendly Optimal Schedule</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {[
              ['7:00 AM', 'Wake up, water, sunlight, and 5 minutes of movement'],
              ['7:30 AM', 'High-protein breakfast'],
              ['9:00 AM', 'Deep work or study block'],
              ['1:00 PM', 'Lunch with protein + carbs + vegetables'],
              ['4:00 PM', 'Short walk or mobility break'],
              ['6:00 PM', 'Workout or active recovery'],
              ['8:00 PM', 'Dinner'],
              ['10:00 PM', 'Screen off, wind down, prepare for sleep']
            ].map(([time, action]) => (
              <div key={time} className="alert alert-info">
                <div className="alert-title">{time}</div>
                <div className="alert-detail">{action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
