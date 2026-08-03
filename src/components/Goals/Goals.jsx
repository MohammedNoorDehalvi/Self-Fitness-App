import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../utils/api';

const GOAL_TYPES = [
  { value: 'lose_weight', label: '⚖️ Lose Weight', unit: 'kg', targetLabel: 'Target weight (kg)', icon: '📉' },
  { value: 'gain_weight', label: '💪 Gain Weight', unit: 'kg', targetLabel: 'Target weight (kg)', icon: '📈' },
  { value: 'improve_sleep', label: '😴 Improve Sleep', unit: 'hrs', targetLabel: 'Target avg sleep (hrs)', icon: '🌙' },
  { value: 'increase_water', label: '💧 Drink More Water', unit: 'L', targetLabel: 'Daily target (litres)', icon: '💧' },
  { value: 'exercise_more', label: '🏃 Exercise More', unit: 'min/week', targetLabel: 'Target weekly minutes', icon: '🏋️' },
  { value: 'maintain_weight', label: '⚖️ Maintain Weight', unit: 'kg', targetLabel: 'Target weight (kg)', icon: '⚖️' },
  { value: 'build_muscle', label: '💪 Build Muscle', unit: 'kg', targetLabel: 'Target weight (kg)', icon: '💪' },
  { value: 'reduce_stress', label: '🧘 Reduce Stress', unit: '/10', targetLabel: 'Target avg mood score', icon: '🧘' },
];

const ProgressBar = ({ progress, color = '#00d4ff' }) => (
  <div style={{ marginTop: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
      <span>Progress</span>
      <span style={{ fontWeight: 700, color }}>{progress}%</span>
    </div>
    <div className="progress-bar-container" style={{ height: 10 }}>
      <div className="progress-bar-fill" style={{
        width: `${progress}%`,
        background: progress >= 100 ? '#00ff88' : progress >= 75 ? color : progress >= 50 ? '#f59e0b' : '#ef4444',
        transition: 'width 0.8s ease'
      }} />
    </div>
  </div>
);

export default function Goals({ profile, toast }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'lose_weight', target: '', deadline: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const data = await api.getGoalsProgress();
      setGoals(data);
    } catch (e) {
      console.warn('Goals load error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.target || isNaN(parseFloat(form.target))) {
      toast('Please enter a valid target value', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.saveGoal(form);
      setShowForm(false);
      setForm({ type: 'lose_weight', target: '', deadline: '', description: '' });
      await loadGoals();
      toast('Goal created! 🎯', 'success');
    } catch (e) {
      toast(`Failed to create goal: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.deleteGoal(id);
      setGoals(g => g.filter(go => go.id !== id));
      toast('Goal deleted', 'info');
    } catch (e) {
      toast('Failed to delete', 'error');
    }
  };

  const selectedType = GOAL_TYPES.find(t => t.value === form.type);

  const getGoalStatusColor = (goal) => {
    if (goal.achieved) return '#00ff88';
    if (goal.progress >= 75) return '#00d4ff';
    if (goal.progress >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) return <div className="loading-container"><div className="spinner" /><span>Loading goals...</span></div>;

  return (
    <div>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="section-title">🎯 Health Goals</h1>
            <p className="section-subtitle">Set, track, and achieve your personal health targets</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ New Goal'}
          </button>
        </div>
      </div>

      {/* Add goal form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 20 }}>
          <div className="card-title">🎯 Create New Goal</div>

          <div className="form-group">
            <label>Goal Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {GOAL_TYPES.map(gt => (
                <button
                  key={gt.value}
                  onClick={() => setForm(f => ({ ...f, type: gt.value }))}
                  style={{
                    padding: '10px 8px', border: '1px solid',
                    borderColor: form.type === gt.value ? 'var(--accent-cyan)' : 'var(--border)',
                    background: form.type === gt.value ? 'rgba(0,212,255,0.1)' : 'var(--bg-input)',
                    borderRadius: 8, cursor: 'pointer', fontSize: 12, textAlign: 'center',
                    fontFamily: 'var(--font-main)', color: form.type === gt.value ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: 500, transition: 'all 0.15s'
                  }}
                >
                  {gt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{selectedType?.targetLabel || 'Target Value'}</label>
              <input
                type="number" step="0.1"
                placeholder={selectedType?.unit ? `Value in ${selectedType.unit}` : 'Enter target'}
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              />
              {form.target && profile && (
                <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
                  {form.type === 'lose_weight' && profile.weight && `Need to lose: ${(profile.weight - parseFloat(form.target)).toFixed(1)}kg`}
                  {form.type === 'gain_weight' && profile.weight && `Need to gain: ${(parseFloat(form.target) - profile.weight).toFixed(1)}kg`}
                  {form.type === 'improve_sleep' && `Target: ${form.target} hours/night`}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Target Deadline (optional)</label>
              <input
                type="date"
                min={format(new Date(), 'yyyy-MM-dd')}
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
              {form.target && form.deadline && form.type === 'lose_weight' && profile?.weight && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Rate needed: {((profile.weight - parseFloat(form.target)) / Math.max(1, getDaysRemaining(form.deadline) / 7)).toFixed(2)} kg/week
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Summer holiday preparation, doctor's recommendation..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <button
            className="btn btn-success"
            onClick={handleSave}
            disabled={saving || !form.target}
            style={{ padding: '12px 28px' }}
          >
            {saving ? '⏳ Creating...' : '🎯 Create Goal'}
          </button>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <h3>No goals yet</h3>
            <p>Create your first health goal to start tracking your progress towards a healthier lifestyle.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowForm(true)}>
              + Create First Goal
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {goals.map(goal => {
            const type = GOAL_TYPES.find(t => t.value === goal.type);
            const daysLeft = getDaysRemaining(goal.deadline);
            const statusColor = getGoalStatusColor(goal);

            return (
              <div key={goal.id} className="card" style={{
                border: `1px solid ${goal.achieved ? 'rgba(0,255,136,0.3)' : 'var(--border)'}`,
                background: goal.achieved ? 'rgba(0,255,136,0.04)' : 'var(--gradient-card)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{type?.icon || '🎯'}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {type?.label || goal.type}
                    </div>
                    {goal.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{goal.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {goal.achieved && <span className="badge badge-success">✅ Achieved!</span>}
                    <button
                      onClick={() => handleDelete(goal.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Progress stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Start</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {goal.startValue ?? '—'}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> {type?.unit}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Current</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>
                      {goal.currentValue ?? '—'}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> {type?.unit}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Target</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {goal.target}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> {type?.unit}</span>
                    </div>
                  </div>
                </div>

                <ProgressBar progress={goal.progress || 0} color={statusColor} />

                {/* Deadline */}
                {goal.deadline && (
                  <div style={{ marginTop: 10, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      📅 Deadline: {format(new Date(goal.deadline), 'MMM d, yyyy')}
                    </span>
                    <span style={{
                      color: daysLeft <= 7 ? 'var(--accent-red)' : daysLeft <= 30 ? 'var(--accent-amber)' : 'var(--accent-green)',
                      fontWeight: 600
                    }}>
                      {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today!' : `${Math.abs(daysLeft)} days overdue`}
                    </span>
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                  Created {format(new Date(goal.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal tips */}
      {goals.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">💡 Goal Achievement Tips</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
            {[
              { icon: '📋', tip: 'Log daily health data to automatically track goal progress against your baseline.' },
              { icon: '📉', tip: 'For weight goals, aim for 0.5-1 kg/week change — any faster risks muscle loss.' },
              { icon: '🔁', tip: 'Consistency beats intensity. Small daily actions compound over weeks and months.' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-input)', borderRadius: 8, padding: 14 }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ lineHeight: 1.5 }}>{t.tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
