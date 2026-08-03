import React, { useState, useEffect } from 'react';
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
  };
};
// ── Mood emoji picker ──
const MOODS = [
  { value: 1, emoji: '😫', label: 'Terrible' },
  { value: 2, emoji: '😞', label: 'Bad' },
  { value: 3, emoji: '😕', label: 'Poor' },
  { value: 4, emoji: '😐', label: 'Below avg' },
  { value: 5, emoji: '🙂', label: 'OK' },
  { value: 6, emoji: '😊', label: 'Good' },
  { value: 7, emoji: '😄', label: 'Great' },
  { value: 8, emoji: '😁', label: 'Very Good' },
  { value: 9, emoji: '🤩', label: 'Excellent' },
  { value: 10, emoji: '🌟', label: 'Perfect' }
];

const EXERCISE_TYPES = [
  'Walking', 'Running', 'Cycling', 'Swimming', 'Weight Training',
  'Yoga', 'HIIT', 'Sports', 'Dancing', 'Hiking', 'Other'
];

const MEAL_TIMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-workout', 'Post-workout'];

const EXERCISE_METS = {
  walking: 3.5,
  running: 7.5,
  cycling: 6.8,
  swimming: 8,
  'weight training': 5.5,
  yoga: 2.8,
  hiit: 9.5,
  sports: 7,
  dancing: 5.5,
  hiking: 6,
  other: 4.5
};

const estimateExerciseCalories = (profile, exercise) => {
  const duration = Number(exercise?.duration) || 0;
  const weight = Number(profile?.weight) > 0 ? Number(profile.weight) : 70;
  const type = String(exercise?.type || exercise?.name || 'other').trim().toLowerCase();
  const intensity = String(exercise?.intensity || 'moderate').toLowerCase();
  const metBase = EXERCISE_METS[type] || EXERCISE_METS.other;
  const intensityMultiplier = intensity === 'light' ? 0.85 : intensity === 'intense' ? 1.2 : 1;
  return Math.max(0, Math.round(metBase * intensityMultiplier * weight * (duration / 60)));
};

const emptyForm = () => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  sleep: '',
  water: '',
  weight: '',
  exercise: { type: 'Walking', name: '', duration: '', intensity: 'moderate' },
  meals: [],
  mood: null,
  notes: ''
});

// ── Mini progress bar ──
const ProgressRing = ({ value, max, color, label, unit }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `conic-gradient(${color} ${pct}%, var(--border) ${pct}%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 8px',
        boxShadow: `0 0 12px ${color}30`
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)'
        }}>
          {value || 0}
        </div>
      </div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 10, color: color, fontWeight: 600 }}>{unit}</div>
    </div>
  );
};

export default function HealthTracker({ profile, onLogSaved, toast }) {
  const [form, setForm] = useState(emptyForm());
  const [logs, setLogs] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [aiDashboard, setAiDashboard] = useState(null);
  const [exerciseAnalysis, setExerciseAnalysis] = useState(null);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('log');
  const [newMeal, setNewMeal] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', time: 'Breakfast' });
  const [addingMeal, setAddingMeal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [today, allLogs, dashboardAI] = await Promise.all([
        api.getTodayLog(),
        api.getLogs(30),
        api.getDashboardAI()
      ]);

      if (today) {
        setTodayLog(today);
        setForm({
          date: format(new Date(), 'yyyy-MM-dd'),
          sleep: today.sleep || '',
          water: today.water || '',
          weight: today.weight || '',
          exercise: today.exercise || { type: 'Walking', name: '', duration: '', intensity: 'moderate' },
          meals: today.meals || [],
          mood: today.mood || null,
          notes: today.notes || ''
        });
        setCustomExerciseName(today.exercise?.name || '');
        setExerciseAnalysis(today.exerciseAnalysis || null);
      }
      setLogs(allLogs);
      setAiDashboard(dashboardAI);
    } catch (e) {
      console.warn('Tracker load error:', e.message);
    }
  };

  const handleSave = async () => {
    const payload = {
      date: form.date,
      sleep: form.sleep ? parseFloat(form.sleep) : undefined,
      water: form.water ? parseFloat(form.water) : undefined,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      exercise: form.exercise.duration ? { ...form.exercise, name: form.exercise.type === 'Other' ? customExerciseName : form.exercise.name } : undefined,
      meals: form.meals,
      mood: form.mood,
      notes: form.notes
    };

    setSaving(true);
    try {
      const result = await api.saveLog(payload);
      setTodayLog(result.log);
      if (result.aiDashboard) setAiDashboard(result.aiDashboard);
      if (result.log?.exerciseAnalysis) setExerciseAnalysis(result.log.exerciseAnalysis);
      if (onLogSaved) onLogSaved(result);
      loadData();
    } catch (e) {
      toast(`Failed to save: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExercise = async () => {
    const exerciseName = form.exercise.type === 'Other' ? customExerciseName.trim() : '';
    const exercisePayload = {
      date: form.date,
      exercise: {
        ...form.exercise,
        name: exerciseName
      },
      name: exerciseName
    };

    if (!form.exercise.duration || Number(form.exercise.duration) <= 0) {
      toast('Please enter an exercise duration before saving.', 'error');
      return;
    }

    if (form.exercise.type === 'Other' && !exerciseName) {
      toast('Please enter an Exercise Name for Other.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await api.saveExercise(exercisePayload);
      setTodayLog(result.log);
      if (result.aiDashboard) setAiDashboard(result.aiDashboard);
      if (result.exerciseAnalysis) setExerciseAnalysis(result.exerciseAnalysis);
      if (result.log?.exercise?.name || result.log?.exercise?.type) {
        setForm(f => ({
          ...f,
          exercise: {
            ...f.exercise,
            name: result.log.exercise.name || f.exercise.name || ''
          }
        }));
      }
      if (onLogSaved) onLogSaved(result);
      loadData();
      toast('Exercise saved successfully.', 'success');
    } catch (e) {
      toast(`Failed to save exercise: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMeal = () => {
    if (!newMeal.name) return;
    const meal = {
      name: newMeal.name,
      calories: newMeal.calories ? parseInt(newMeal.calories) : 0,
      protein: newMeal.protein ? parseFloat(newMeal.protein) : 0,
      carbs: newMeal.carbs ? parseFloat(newMeal.carbs) : 0,
      fat: newMeal.fat ? parseFloat(newMeal.fat) : 0,
      time: newMeal.time
    };
    setForm(f => ({ ...f, meals: [...f.meals, meal] }));
    setNewMeal({ name: '', calories: '', protein: '', carbs: '', fat: '', time: 'Breakfast' });
    setAddingMeal(false);
  };

  const removeMeal = (idx) => setForm(f => ({ ...f, meals: f.meals.filter((_, i) => i !== idx) }));

  // Calculate today's totals
  const totalCals = form.meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = form.meals.reduce((s, m) => s + (m.protein || 0), 0);
  const tdee = profile ? Math.round((88.362 + 13.397 * profile.weight + 4.799 * profile.height - 5.677 * profile.age) * 1.4) : 2000;
  const waterTarget = profile ? parseFloat((profile.weight * 0.033).toFixed(1)) : 2.5;
  const todayExerciseCaloriesFromHistory = (todayLog?.exerciseHistory || []).reduce(
    (sum, item) => sum + (Number(item?.caloriesBurned) || 0),
    0
  );
  const todayExerciseCalories = Number(
    todayLog?.exerciseCaloriesBurnedTotal ??
    todayLog?.exerciseCaloriesBurned ??
    todayExerciseCaloriesFromHistory ??
    0
  );
  const currentExerciseEstimate = estimateExerciseCalories(profile, form.exercise);
  const exerciseSessionsToday = (todayLog?.exerciseHistory || []).length || (todayLog?.exercise ? 1 : 0);

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">📋 Health Tracker</h1>
        <p className="section-subtitle">Log your daily health metrics to build insights over time</p>
      </div>

      {/* Tabs */}
      <div className="tab-group">
        <button className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          📝 Today's Log
        </button>
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📅 History (30d)
        </button>
      </div>

      {activeTab === 'log' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Main form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Date */}
            <div className="card">
              <div className="card-title">📅 Log Date</div>
              <input
                type="date"
                value={form.date}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
              {todayLog && (
                <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 8 }}>
                  ✅ Today's log exists — saving will update it
                </div>
              )}
            </div>

            {/* Vitals */}
            <div className="card">
              <div className="card-title">🩺 Vitals</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sleep Hours</label>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    placeholder="e.g. 7.5"
                    value={form.sleep}
                    onChange={e => setForm(f => ({ ...f, sleep: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: form.sleep >= 7 ? 'var(--accent-green)' : form.sleep > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: 4 }}>
                    {form.sleep >= 7 ? '✅ Good sleep' : form.sleep > 0 && form.sleep < 7 ? `⚠️ ${(7 - form.sleep).toFixed(1)}h below recommendation` : 'Recommended: 7-9 hours'}
                  </div>
                </div>
                <div className="form-group">
                  <label>Water (Litres)</label>
                  <input
                    type="number" min="0" max="10" step="0.25"
                    placeholder={`Target: ${waterTarget}L`}
                    value={form.water}
                    onChange={e => setForm(f => ({ ...f, water: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: form.water >= waterTarget ? 'var(--accent-green)' : form.water > 0 ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: 4 }}>
                    {form.water > 0
                      ? form.water >= waterTarget ? '✅ Goal met!' : `${(waterTarget - form.water).toFixed(2)}L to go`
                      : `Target: ${waterTarget}L for your weight`}
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Body Weight (kg)</label>
                <input
                  type="number" min="0" max="500" step="0.1"
                  placeholder={profile ? `Last: ${profile.weight}kg` : "e.g. 70.5"}
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                />
              </div>
            </div>

            {/* Exercise */}
            <div className="card">
              <div className="card-title">🏃 Exercise</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={form.exercise.type}
                    onChange={e => setForm(f => ({
                      ...f,
                      exercise: {
                        ...f.exercise,
                        type: e.target.value,
                        name: e.target.value === 'Other' ? (f.exercise.name || customExerciseName) : ''
                      }
                    }))}
                  >
                    {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number" min="0" max="600" step="5"
                    placeholder="e.g. 30"
                    value={form.exercise.duration}
                    onChange={e => setForm(f => ({ ...f, exercise: { ...f.exercise, duration: e.target.value } }))}
                  />
                </div>
              </div>
              {form.exercise.type === 'Other' && (
                <div className="form-group">
                  <label>Exercise Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rope Skipping, Martial Arts, Home Workout"
                    value={customExerciseName}
                    onChange={e => {
                      setCustomExerciseName(e.target.value);
                      setForm(f => ({ ...f, exercise: { ...f.exercise, name: e.target.value } }));
                    }}
                  />
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Intensity</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['light', 'moderate', 'intense'].map(level => (
                    <button
                      key={level}
                      onClick={() => setForm(f => ({ ...f, exercise: { ...f.exercise, intensity: level } }))}
                      style={{
                        flex: 1, padding: '8px', border: '1px solid',
                        borderColor: form.exercise.intensity === level ? 'var(--accent-cyan)' : 'var(--border)',
                        background: form.exercise.intensity === level ? 'rgba(0,212,255,0.1)' : 'transparent',
                        color: form.exercise.intensity === level ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        borderRadius: 6, cursor: 'pointer', fontSize: 13, textTransform: 'capitalize',
                        fontFamily: 'var(--font-main)', fontWeight: 500, transition: 'all 0.15s'
                      }}
                    >
                      {level === 'light' ? '🚶 Light' : level === 'moderate' ? '🏃 Moderate' : '💪 Intense'}
                    </button>
                  ))}
                </div>
              </div>
              {form.exercise.duration > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent-cyan)' }}>
                  🤖 AI predicted calories burned: <b>{currentExerciseEstimate}</b> kcal
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    Based on duration, intensity, and your profile weight when available.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-success"
                  onClick={handleSaveExercise}
                  disabled={saving || !form.exercise.duration}
                  style={{ flex: 1, minWidth: 180 }}
                >
                  {saving ? '⏳ Saving Exercise...' : '💾 Save Exercise'}
                </button>
              </div>

              {exerciseAnalysis && (
                <div style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,212,255,0.2)',
                  background: 'rgba(0,212,255,0.05)',
                  fontSize: 13,
                  lineHeight: 1.7
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>🤖 AI Exercise Analysis</div>
                  <div>Summary: {toDisplayText(exerciseAnalysis.summary)}</div>
                  <div>Calories burned: {toDisplayText(exerciseAnalysis.caloriesBurned)} kcal</div>
                  {Array.isArray(exerciseAnalysis.insights) && exerciseAnalysis.insights.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {exerciseAnalysis.insights.map((item, idx) => (
                        <div key={idx}>• {toDisplayText(item.icon)} {toDisplayText(item.title)} — {toDisplayText(item.message)}</div>
                      ))}
                    </div>
                  )}
                  {Array.isArray(exerciseAnalysis.suggestions) && exerciseAnalysis.suggestions.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {exerciseAnalysis.suggestions.map((item, idx) => (
                        <div key={idx}>• {toDisplayText(item.icon)} {toDisplayText(item.title)} — {toDisplayText(item.action || item.message)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Meals */}
            <div className="card">
              <div className="card-title">🍽️ Meals</div>

              {form.meals.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {form.meals.map((meal, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8,
                      marginBottom: 6, border: '1px solid var(--border)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{meal.time} — {meal.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {meal.calories > 0 && `${meal.calories} kcal`}
                          {meal.protein > 0 && ` • ${meal.protein}g protein`}
                          {meal.carbs > 0 && ` • ${meal.carbs}g carbs`}
                          {meal.fat > 0 && ` • ${meal.fat}g fat`}
                        </div>
                      </div>
                      <button onClick={() => removeMeal(i)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button>
                    </div>
                  ))}
                  <div style={{
                    background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', gap: 20, fontSize: 13
                  }}>
                    <span>🔥 <b>{totalCals}</b> kcal</span>
                    <span>🥩 <b>{totalProtein.toFixed(0)}g</b> protein</span>
                    <span style={{ color: totalCals > tdee ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                      {totalCals > tdee ? `+${totalCals - tdee} surplus` : `${tdee - totalCals} under target`}
                    </span>
                  </div>
                </div>
              )}

              {addingMeal ? (
                <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div>
                      <label>Meal Time</label>
                      <select value={newMeal.time} onChange={e => setNewMeal(m => ({ ...m, time: e.target.value }))}>
                        {MEAL_TIMES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Food Name *</label>
                      <input placeholder="e.g. Oatmeal with banana"
                        value={newMeal.name}
                        onChange={e => setNewMeal(m => ({ ...m, name: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {[
                      { key: 'calories', label: 'Calories', placeholder: 'kcal' },
                      { key: 'protein', label: 'Protein', placeholder: 'grams' },
                      { key: 'carbs', label: 'Carbs', placeholder: 'grams' },
                      { key: 'fat', label: 'Fat', placeholder: 'grams' }
                    ].map(f => (
                      <div key={f.key}>
                        <label>{f.label}</label>
                        <input type="number" min="0" placeholder={f.placeholder}
                          value={newMeal[f.key]}
                          onChange={e => setNewMeal(m => ({ ...m, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-success" onClick={handleAddMeal} style={{ flex: 1 }}>Add Meal</button>
                    <button className="btn btn-ghost" onClick={() => setAddingMeal(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => setAddingMeal(true)} style={{ width: '100%', borderStyle: 'dashed' }}>
                  + Add Meal / Food Entry
                </button>
              )}
            </div>

            {/* Mood */}
            <div className="card">
              <div className="card-title">😊 Mood (1–10)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                    title={m.label}
                    style={{
                      width: 44, height: 44, borderRadius: 8, border: '1px solid',
                      borderColor: form.mood === m.value ? 'var(--accent-cyan)' : 'var(--border)',
                      background: form.mood === m.value ? 'rgba(0,212,255,0.15)' : 'var(--bg-input)',
                      cursor: 'pointer', fontSize: 20, transition: 'all 0.15s',
                      transform: form.mood === m.value ? 'scale(1.15)' : 'scale(1)'
                    }}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
              {form.mood && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent-cyan)' }}>
                  Selected: {MOODS.find(m => m.value === form.mood)?.emoji} {MOODS.find(m => m.value === form.mood)?.label} ({form.mood}/10)
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card">
              <div className="card-title">📝 Notes</div>
              <textarea
                rows={3}
                placeholder="How are you feeling today? Any observations about energy, digestion, stress, etc."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Save button */}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ width: '100%', padding: '14px', fontSize: 15 }}
            >
              {saving ? '⏳ Saving...' : '💾 Save Today\'s Log'}
            </button>
          </div>

          {/* Sidebar summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Today's progress rings */}
            <div className="card">
              <div className="card-title">📊 Today's Progress</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <ProgressRing value={form.sleep || 0} max={9} color="#8b5cf6" label="Sleep" unit="/ 9h" />
                <ProgressRing value={form.water || 0} max={waterTarget} color="#00d4ff" label="Water" unit={`/ ${waterTarget}L`} />
                <ProgressRing value={todayExerciseCalories || 0} max={400} color="#00ff88" label="Burned kcal" unit="/ 400 kcal" />
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                {todayExerciseCalories > 0 && <div>🔥 {todayExerciseCalories} kcal burned today</div>}
                {exerciseSessionsToday > 0 && <div>{exerciseSessionsToday} exercise session(s) saved today</div>}
                {totalCals > 0 && <div>🍽️ {totalCals} / {tdee} kcal eaten</div>}
              </div>
            </div>

            {/* Quick tips */}
            <div className="card">
              <div className="card-title">💡 Daily Tips</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {[
                  !form.sleep || form.sleep < 7 ? '• Aim for 7-9 hours of sleep tonight' : '• ✅ Great sleep target!',
                  !form.water || parseFloat(form.water) < waterTarget ? `• Drink ${((waterTarget - (parseFloat(form.water) || 0)).toFixed(1))}L more today` : '• ✅ Water goal met!',
                  !form.exercise.duration ? '• Add at least 20 min of movement' : '• ✅ Exercise logged!',
                  form.meals.length === 0 ? '• Log your meals for nutrition tracking' : `• ${form.meals.length} meal(s) logged today`,
                  !form.mood ? '• Rate your mood to track patterns' : `• Mood: ${MOODS.find(m => m.value === form.mood)?.emoji}`
                ].map((tip, i) => <div key={i} style={{ marginBottom: 4 }}>{tip}</div>)}
              </div>
            </div>


            {/* AI guidance */}
            {aiDashboard?.tracker && (
              <div className="card">
                <div className="card-title">🤖 AI Guidance</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {toDisplayText(aiDashboard.tracker.dailyFocus)}
                  </div>
                  <div>• Sleep target: {aiDashboard.tracker.sleepTarget}h</div>
                  <div>• Water target: {aiDashboard.tracker.waterTarget}L</div>
                  <div>• Exercise target: {aiDashboard.tracker.exerciseTarget} min</div>
                  <div>• Exercise sessions today: {aiDashboard.tracker.exerciseSessionsToday || 0}</div>
                  <div>• Exercise minutes today: {aiDashboard.tracker.exerciseMinutesToday || 0}</div>
                  <div>• Logs tracked: {aiDashboard.tracker.totalLogs}</div>
                </div>
              </div>
            )}

            {/* BMI quick view */}
            {profile && (
              <div className="card">
                <div className="card-title">📊 BMI Snapshot</div>
                {(() => {
                  const h = profile.height / 100;
                  const w = form.weight ? parseFloat(form.weight) : profile.weight;
                  const bmi = (w / (h * h)).toFixed(1);
                  const cat = bmi < 18.5 ? { label: 'Underweight', color: '#eab308' } :
                    bmi < 25 ? { label: 'Normal', color: '#00ff88' } :
                    bmi < 30 ? { label: 'Overweight', color: '#f59e0b' } :
                    { label: 'Obese', color: '#ef4444' };
                  return (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-mono)', color: cat.color }}>{bmi}</div>
                      <div className={`badge badge-${cat.color === '#00ff88' ? 'success' : cat.color === '#ef4444' ? 'danger' : 'warn'}`} style={{ margin: '6px auto' }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Based on {w}kg / {profile.height}cm</div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title">📅 30-Day Log History</div>
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No logs yet</h3>
              <p>Start logging your daily health metrics to see your history here.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Date', 'Sleep', 'Water', 'Weight', 'Exercise', 'Calories', 'Mood', 'Notes'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '10px 12px',
                        color: 'var(--text-muted)', fontWeight: 600,
                        fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em',
                        borderBottom: '1px solid var(--border)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...logs].reverse().map((log, i) => {
                    const totalCals = (log.meals || []).reduce((s, m) => s + (m.calories || 0), 0);
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          {format(parseISO(log.date), 'MMM d')}
                        </td>
                        <td style={{ padding: '10px 12px', color: log.sleep >= 7 ? 'var(--accent-green)' : log.sleep > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                          {log.sleep > 0 ? `${log.sleep}h` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)' }}>
                          {log.water > 0 ? `${log.water}L` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{log.weight ? `${log.weight}kg` : '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {log.exercise?.duration > 0 ? `${log.exercise.duration}m ${log.exercise.name || log.exercise.type}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{totalCals > 0 ? `${totalCals} kcal` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 18 }}>
                          {log.mood ? MOODS.find(m => m.value === log.mood)?.emoji : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}