import React, { useState, useEffect } from 'react';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', icon: '🪑' },
  { value: 'light', label: 'Lightly Active', desc: '1-3 days/week exercise', icon: '🚶' },
  { value: 'moderate', label: 'Moderately Active', desc: '3-5 days/week exercise', icon: '🏃' },
  { value: 'active', label: 'Very Active', desc: '6-7 days/week exercise', icon: '💪' },
  { value: 'very_active', label: 'Extremely Active', desc: 'Physical job + exercise', icon: '🏋️' },
];

export default function Profile({ profile, onSave, toast }) {
  const [form, setForm] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    gender: 'male',
    activityLevel: 'moderate'
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        age: profile.age || '',
        height: profile.height || '',
        weight: profile.weight || '',
        gender: profile.gender || 'male',
        activityLevel: profile.activityLevel || 'moderate'
      });
    }
  }, [profile]);

  const validate = () => {
    const errs = {};
    if (!form.age || form.age < 5 || form.age > 120) errs.age = 'Age must be between 5 and 120';
    if (!form.height || form.height < 50 || form.height > 300) errs.height = 'Height must be between 50-300 cm';
    if (!form.weight || form.weight < 10 || form.weight > 500) errs.weight = 'Weight must be between 10-500 kg';
    if (!form.gender) errs.gender = 'Gender is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  // Live calculations preview
  const bmi = form.weight && form.height
    ? (parseFloat(form.weight) / Math.pow(parseFloat(form.height) / 100, 2)).toFixed(1)
    : null;

  const bmiCat = bmi
    ? bmi < 18.5 ? { label: 'Underweight', color: '#3b82f6' }
      : bmi < 25 ? { label: 'Normal', color: '#22c55e' }
      : bmi < 30 ? { label: 'Overweight', color: '#f59e0b' }
      : { label: 'Obese', color: '#ef4444' }
    : null;

  const bmr = form.weight && form.height && form.age
    ? form.gender === 'male'
      ? Math.round(88.362 + 13.397 * form.weight + 4.799 * form.height - 5.677 * form.age)
      : Math.round(447.593 + 9.247 * form.weight + 3.098 * form.height - 4.330 * form.age)
    : null;

  const palMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = bmr ? Math.round(bmr * (palMap[form.activityLevel] || 1.55)) : null;

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">👤 Health Profile</h1>
        <p className="section-subtitle">Your profile powers all AI recommendations and biometric calculations</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">👤 Basic Information</div>

            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <input
                  type="number" min="5" max="120"
                  placeholder="e.g. 28"
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  style={{ borderColor: errors.age ? 'var(--accent-red)' : undefined }}
                />
                {errors.age && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 4 }}>{errors.age}</div>}
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  {[
                    { v: 'male', label: '♂ Male' },
                    { v: 'female', label: '♀ Female' },
                    { v: 'other', label: '⚧ Other' }
                  ].map(g => (
                    <button
                      key={g.v}
                      onClick={() => setForm(f => ({ ...f, gender: g.v }))}
                      style={{
                        flex: 1, padding: '9px 8px', border: '1px solid',
                        borderColor: form.gender === g.v ? 'var(--accent-cyan)' : 'var(--border)',
                        background: form.gender === g.v ? 'rgba(0,212,255,0.1)' : 'transparent',
                        color: form.gender === g.v ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        borderRadius: 6, cursor: 'pointer', fontSize: 12,
                        fontFamily: 'var(--font-main)', fontWeight: 500, transition: 'all 0.15s'
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Height (cm) *</label>
                <input
                  type="number" min="50" max="300" step="0.5"
                  placeholder="e.g. 175"
                  value={form.height}
                  onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                  style={{ borderColor: errors.height ? 'var(--accent-red)' : undefined }}
                />
                {form.height && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    = {(form.height / 30.48).toFixed(1)} ft / {Math.floor(form.height / 2.54 / 12)}'{Math.round(form.height / 2.54 % 12)}"
                  </div>
                )}
                {errors.height && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 4 }}>{errors.height}</div>}
              </div>
              <div className="form-group">
                <label>Weight (kg) *</label>
                <input
                  type="number" min="10" max="500" step="0.1"
                  placeholder="e.g. 70"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  style={{ borderColor: errors.weight ? 'var(--accent-red)' : undefined }}
                />
                {form.weight && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    = {(form.weight * 2.205).toFixed(1)} lbs
                  </div>
                )}
                {errors.weight && <div style={{ color: 'var(--accent-red)', fontSize: 12, marginTop: 4 }}>{errors.weight}</div>}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">🏃 Activity Level</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Your activity level affects calorie calculations, water needs, and exercise recommendations.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ACTIVITY_LEVELS.map(al => (
                <button
                  key={al.value}
                  onClick={() => setForm(f => ({ ...f, activityLevel: al.value }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', border: '1px solid',
                    borderColor: form.activityLevel === al.value ? 'var(--accent-cyan)' : 'var(--border)',
                    background: form.activityLevel === al.value ? 'rgba(0,212,255,0.08)' : 'var(--bg-input)',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s', width: '100%'
                  }}
                >
                  <span style={{ fontSize: 24 }}>{al.icon}</span>
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: form.activityLevel === al.value ? 'var(--accent-cyan)' : 'var(--text-primary)'
                    }}>{al.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{al.desc}</div>
                  </div>
                  {form.activityLevel === al.value && (
                    <div style={{ marginLeft: 'auto', color: 'var(--accent-cyan)', fontSize: 18 }}>✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
          >
            {saving ? '⏳ Saving...' : profile ? '💾 Update Profile' : '🚀 Create Profile'}
          </button>

          {profile && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Last updated: {new Date(profile.updatedAt).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">📊 Live Calculations</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Updates as you fill in your profile data
            </p>

            {/* BMI */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>BMI</span>
                {bmiCat && <span className={`badge badge-${bmiCat.color === '#22c55e' ? 'success' : bmiCat.color === '#ef4444' ? 'danger' : 'warn'}`}>{bmiCat.label}</span>}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-mono)', color: bmiCat?.color || 'var(--text-muted)' }}>
                {bmi || '—'}
              </div>
            </div>

            <div className="divider" style={{ margin: '12px 0' }} />

            {[
              { label: 'BMR (Base Metabolic Rate)', value: bmr, unit: 'kcal/day', desc: 'Calories burned at complete rest', color: 'var(--accent-cyan)' },
              { label: 'TDEE (Daily Energy Need)', value: tdee, unit: 'kcal/day', desc: 'Total daily calorie requirement', color: 'var(--accent-purple)' },
              { label: 'Water Need', value: form.weight ? (parseFloat(form.weight) * 0.033).toFixed(1) : null, unit: 'L/day', desc: '33ml per kg body weight', color: '#3b82f6' },
              { label: 'Ideal Weight Range', value: form.height && form.gender ? (() => {
                const h = (parseFloat(form.height) - 152.4) / 2.54;
                const base = form.gender === 'male' ? 50 + 2.3 * h : 45.5 + 2.3 * h;
                return `${(base * 0.9).toFixed(0)}–${(base * 1.1).toFixed(0)}`;
              })() : null, unit: 'kg', desc: 'Devine formula range', color: 'var(--accent-green)' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>{item.desc}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value || '—'}</span>
                    {item.value && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.unit}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy notice */}
          <div className="card" style={{ background: 'rgba(0,212,255,0.04)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: 8 }}>🔒 Data Privacy</div>
              <div>• All data stored locally on your device</div>
              <div>• No accounts, no cloud, no tracking</div>
              <div>• Data persists across page refreshes</div>
              <div>• Delete by clearing your browser data</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
