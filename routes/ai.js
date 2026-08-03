/**
 * ============================================================
 * AI ROUTE — Groq API (FREE)
 * ============================================================
 * Model  : llama-3.3-70b-versatile (free on Groq)
 * Get key: https://console.groq.com  (no credit card needed)
 * Free tier: 14,400 req/day | 500K tokens/min
 * 
 * The system prompt injects:
 *   • Full user profile + biometrics (BMI, BMR, TDEE, macros)
 *   • Last 7 days of health logs
 *   • Active goals + progress
 *   • Streaks + achievements
 *   • Real-time location (city, country, timezone)
 *   • Current date, time and time-of-day context
 * ============================================================
 */

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const { URL } = require('url');
const { readDB, writeDB }   = require('../utils/db');
const { analyzeHealthData } = require('../utils/aiEngine');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';  // best free model on Groq

const requestJson = async (url, options = {}) => {
  if (typeof fetch === 'function') {
    return fetch(url, options);
  }

  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        method: options.method || 'GET',
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        headers: options.headers || {}
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(body || '{}'),
            text: async () => body
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
};

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL HELPER  (used in multiple route handlers)
// ─────────────────────────────────────────────────────────────
const collectExerciseSessions = (log = {}) => {
  const history = Array.isArray(log.exerciseHistory) && log.exerciseHistory.length
    ? log.exerciseHistory
    : (log.exercise && Number(log.exercise.duration) > 0 ? [log.exercise] : []);
  return history.filter((session) => Number(session?.duration) > 0 || session?.type || session?.name);
};

// ─────────────────────────────────────────────────────────────
// BUILD SYSTEM PROMPT  (all user data injected here)
// ─────────────────────────────────────────────────────────────
const buildSystemPrompt = (db, location) => {
  const { profile, healthLogs = [], goals = [], streaks = {}, routineAnalyses = [], exerciseAnalyses = [] } = db;
  const now      = new Date();
  const timeStr  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hourNow  = now.getHours();
  const tod      = hourNow < 6 ? 'middle of night' : hourNow < 12 ? 'morning' : hourNow < 17 ? 'afternoon' : hourNow < 21 ? 'evening' : 'night';
  const last7    = healthLogs.slice(-7);

  const recentExerciseAnalyses = exerciseAnalyses.slice(-5).map(item => ({
    date: item.date,
    exercise: item.exercise?.name || item.exercise?.type || 'exercise',
    caloriesBurned: item.analysis?.caloriesBurned ?? item.exercise?.caloriesBurned ?? 0,
    summary: item.analysis?.summary || ''
  }));

  // ── Helpers ──
  const avg = (key) => {
    const v = last7.map(l => l[key]).filter(x => x > 0);
    return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : null;
  };
  const avgSleep   = avg('sleep');
  const avgWater   = avg('water');
  const avgMood    = avg('mood');
  const exerciseSessions = last7.flatMap((log) => collectExerciseSessions(log));
  const activeDays = last7.filter((log) => collectExerciseSessions(log).length > 0).length;
  const totalExMin = exerciseSessions.reduce((s, session) => s + (Number(session.duration) || 0), 0);
  const totalExKcal = exerciseSessions.reduce((s, session) => s + (Number(session.caloriesBurned) || 0), 0);
  const latestWt   = [...healthLogs].reverse().find(l => l.weight)?.weight;

  const weightTrend = (() => {
    const wts = healthLogs.filter(l => l.weight).slice(-10).map(l => l.weight);
    if (wts.length < 2) return 'not enough data';
    const diff = wts[wts.length - 1] - wts[0];
    return diff > 0.5  ? `gaining (+${diff.toFixed(1)} kg over ${wts.length} readings)` :
           diff < -0.5 ? `losing (${diff.toFixed(1)} kg over ${wts.length} readings)` : 'stable';
  })();

  // ── Biometrics ──
  const pal = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  let bmi = null, bmr = null, tdee = null, bmiLabel = null, waterTarget = null, macros = null;
  if (profile) {
    bmi        = (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1);
    bmiLabel   = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    bmr        = profile.gender === 'male'
      ? Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5)
      : Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161);
    tdee       = Math.round(bmr * (pal[profile.activityLevel] || 1.55));
    waterTarget = (profile.weight * 0.033).toFixed(1);
    const prot  = Math.round(profile.weight * 1.8);
    const fat   = Math.round(tdee * 0.28 / 9);
    const carb  = Math.round((tdee - prot * 4 - fat * 9) / 4);
    macros      = `${tdee} kcal | ${prot}g protein | ${carb}g carbs | ${fat}g fat`;
  }

  // ── Log table ──
  const logTable = healthLogs.slice(-7).map(l => {
    const cal = (l.meals || []).reduce((s, m) => s + (m.calories || 0), 0);
    const exerciseSummary = l.exerciseHistory?.length
      ? `${l.exerciseHistory.length} entries, latest ${l.exercise?.duration || 0}min ${l.exercise?.type || ''}`.trim()
      : `${l.exercise?.duration || 0}min ${l.exercise?.type || ''}`.trim();

    return `  ${new Date(l.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: sleep=${l.sleep || '-'}h water=${l.water || '-'}L weight=${l.weight || '-'}kg exercise=${exerciseSummary} mood=${l.mood || '-'}/10 cal=${cal || '-'}`;
  }).join('\n') || '  No entries yet.';

  // ── Meals ──
  const mealSummary = last7.filter(l => l.meals?.length > 0).slice(-3).map(l => {
    const cal  = l.meals.reduce((s, m) => s + (m.calories || 0), 0);
    const prot = l.meals.reduce((s, m) => s + (m.protein || 0), 0);
    return `  * ${new Date(l.date).toLocaleDateString('en-US', { weekday: 'short' })}: ${cal} kcal, ${prot}g protein — ${l.meals.map(m => m.name).join(', ')}`;
  }).join('\n') || '  No meals logged recently.';

  // ── Goals ──
  const activeGoals = goals.filter(g => !g.achieved);
  const goalsText   = activeGoals.length
    ? activeGoals.map(g =>
        `  - ${g.type.replace(/_/g, ' ')}: target ${g.target}${g.unit || ''} | current ${g.currentValue ?? '?'} | ${g.progress || 0}% done${g.deadline ? ` | due ${new Date(g.deadline).toLocaleDateString()}` : ''}`
      ).join('\n')
    : '  None set yet.';

  // ── Routine history context ──
  const recentRoutineAnalyses = (routineAnalyses || []).slice(0, 5);
  const routineText = recentRoutineAnalyses.length
    ? recentRoutineAnalyses.map((r, idx) => {
        const routinePreview = String(r.routineText || '').trim().slice(0, 900) || 'No routine text saved';
        const analysis = r.analysis || {};
        const issues = Array.isArray(analysis.issues) ? analysis.issues.map((i) => i?.title || i?.message || 'Issue').filter(Boolean).slice(0, 5).join(', ') : '';
        const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions.map((s) => s?.title || s?.message || 'Suggestion').filter(Boolean).slice(0, 5).join(', ') : '';
        return `  ${idx + 1}. ${new Date(r.createdAt || Date.now()).toLocaleString()} | Score: ${analysis.routineScore ?? analysis.score ?? 'n/a'}
     Routine: ${routinePreview}
     Issues: ${issues || 'None'}
     Suggestions: ${suggestions || 'None'}`;
      }).join('\n\n')
    : '  Not analyzed yet.';

  // ── AI alerts ──
  const { warnings, suggestions, score: healthScore } = analyzeHealthData(profile, healthLogs);
  const alerts = [...warnings, ...suggestions].slice(0, 4)
    .map(w => `  ⚠ ${w.title}: ${w.message}${w.action ? ` → ${w.action}` : ''}`).join('\n') || '  None.';

  return `You are VitaAI, an expert AI health and lifestyle coach embedded in a personal health tracking app.
You have FULL access to the user's real health data below. Always cite their actual numbers — never give generic advice.

=== RIGHT NOW ===
Date     : ${dateStr}
Time     : ${timeStr} (${tod})
Location : ${[location?.city, location?.region, location?.country].filter(Boolean).join(', ') || 'Unknown'}
Timezone : ${location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}

=== USER PROFILE ===
${profile
  ? `Name     : ${profile.name || 'Not set'}
Age      : ${profile.age} | Gender: ${profile.gender}
Height   : ${profile.height} cm | Weight: ${profile.weight} kg
Activity : ${profile.activityLevel}
BMI      : ${bmi} (${bmiLabel})
BMR      : ${bmr} kcal/day
TDEE     : ${tdee} kcal/day
Water    : ${waterTarget} L/day target
Macros   : ${macros}`
  : 'No profile set up yet — encourage the user to create one.'}

=== LAST 7-DAY LOG ===
${logTable}

=== 7-DAY AVERAGES ===
Sleep    : ${avgSleep || 'no data'} h/night ${avgSleep ? (avgSleep >= 7 ? '[GOOD ✓]' : avgSleep >= 6 ? '[LOW ⚠]' : '[CRITICAL ✗]') : ''}
Water    : ${avgWater || 'no data'} L/day
Mood     : ${avgMood || 'no data'}/10
Exercise : ${activeDays}/7 active days | ${totalExMin} total min | ${exerciseSessions.length} session(s) | ${totalExKcal || 0} kcal ${totalExMin >= 150 ? '[WHO target met ✓]' : `[${150 - totalExMin} min short of 150 min target]`}
Weight   : ${latestWt || 'no data'} kg | trend: ${weightTrend}

Recent Meals:
${mealSummary}

=== ACTIVE GOALS (${activeGoals.length}) ===
${goalsText}

=== STREAKS ===
Current: ${streaks.currentStreak || 0} days | Best: ${streaks.longestStreak || 0} | Total logged: ${streaks.totalLoggedDays || 0}

=== ROUTINE HISTORY + LATEST ANALYSES ===
${routineText}

=== RECENT EXERCISE ANALYSES ===
${recentExerciseAnalyses.length
  ? recentExerciseAnalyses.map((x, idx) => `  ${idx + 1}. ${x.date} | ${x.exercise} | ${x.caloriesBurned} kcal | ${x.summary}`).join('\n')
  : '  No exercise analyses saved yet.'}

=== AI HEALTH ALERTS (score ${healthScore}/100) ===
${alerts}

=== HOW TO RESPOND ===
1. Always use the user's REAL numbers — never say "typically" or "in general" without citing their data.
2. Be LOCATION-AWARE: mention their city (${location?.city || 'unknown location'}), local time (${timeStr}), and season where relevant.
3. TIME CONTEXT: it is ${tod} — ${hourNow < 6 ? 'focus on getting back to sleep' : hourNow < 12 ? 'great time to energize, eat a good breakfast, and get moving' : hourNow < 17 ? 'sustain energy, hydrate, avoid sugar crashes' : hourNow < 21 ? 'wind down, light dinner, prep for recovery' : 'prioritize sleep, avoid screens and heavy food'}.
4. If their streak is > 0, mention their ${streaks.currentStreak || 0}-day streak to build motivation.
5. Use **bold** for key stats. Use bullet points for lists. Keep responses focused and actionable.
6. NEVER diagnose conditions. If serious symptoms are mentioned, recommend a doctor.
7. Address the user as "${profile?.name || 'there'}" when it feels natural.
8. End with one specific, immediate action they can take RIGHT NOW.`;
};

// ─────────────────────────────────────────────────────────────
// CALL GROQ  (OpenAI-compatible endpoint)
// ─────────────────────────────────────────────────────────────
const callGroq = async (messages, systemPrompt, apiKey) => {
  if (!apiKey || apiKey === 'your-groq-key-here') {
    throw new Error('GROQ_API_KEY_MISSING');
  }

  const response = await requestJson(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    if (response.status === 401) throw new Error('GROQ_INVALID_KEY');
    if (response.status === 429) throw new Error('GROQ_RATE_LIMIT');
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated.';
};

// ─────────────────────────────────────────────────────────────
// POST /api/ai/chat
// ─────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, location } = req.body;
  const apiKey = req.headers['x-groq-key'];
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  const db      = readDB();
  const history = (db.chatHistory || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content }));

  try {
    const aiText = await callGroq(
      [...history, { role: 'user', content: message }],
      buildSystemPrompt(db, location),
      apiKey
    );

    const ts      = new Date().toISOString();
    const userMsg = { id: uuidv4(), role: 'user',      content: message, timestamp: ts };
    const asstMsg = { id: uuidv4(), role: 'assistant', content: aiText,  timestamp: ts };

    db.chatHistory = db.chatHistory || [];
    db.chatHistory.push(userMsg, asstMsg);
    if (db.chatHistory.length > 100) db.chatHistory = db.chatHistory.slice(-100);
    if (location) db.lastKnownLocation = location;
    writeDB(db);

    res.json({
      response: aiText,
      timestamp: ts,
      model: GROQ_MODEL,
      contextUsed: {
        hasProfile: !!db.profile,
        logsCount:  (db.healthLogs || []).length,
        location:   location?.city || 'unknown'
      }
    });

  } catch (err) {
    console.error('Groq API error:', err.message);
    const userErrors = {
      'GROQ_API_KEY_MISSING': '⚠️ **Groq API key not provided.** Please enter your API key in the AI Assistant settings.',
      'GROQ_INVALID_KEY':     '⚠️ **Invalid Groq API key.** Double-check your API key in the AI Assistant settings.',
      'GROQ_RATE_LIMIT':      '⚠️ **Rate limit hit.** Groq free tier allows 30 req/min. Wait a moment and try again.'
    };
    const friendly = userErrors[err.message] || `⚠️ AI service error: ${err.message}`;
    res.status(500).json({ error: friendly });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/ai/daily-brief  (frontend alias)
// POST /api/ai/daily-summary
// ─────────────────────────────────────────────────────────────
const handleDailySummary = async (req, res) => {
  const { location } = req.body;
  const apiKey = req.headers['x-groq-key'];
  const db      = readDB();
  const hourNow = new Date().getHours();
  const period  = hourNow < 12 ? 'morning' : hourNow < 17 ? 'afternoon' : 'evening';

  try {
    const summary = await callGroq([{
      role: 'user',
      content: `Give me a short personalized ${period} health check-in using my actual data:
1. One sentence overall status referencing a specific metric
2. My single most important health focus right now
3. One action I can take in the next 10 minutes (it is ${new Date().toLocaleTimeString()} in ${location?.city || 'my location'})
Keep it under 90 words. Use my real numbers. Be encouraging and specific.`
    }], buildSystemPrompt(db, location), apiKey);

    res.json({ summary, generatedAt: new Date().toISOString(), model: GROQ_MODEL });
  } catch (err) {
    const userErrors = {
      'GROQ_API_KEY_MISSING': '⚠️ **Groq API key not provided.** Please enter your API key in the AI Assistant settings.',
      'GROQ_INVALID_KEY':     '⚠️ **Invalid Groq API key.** Double-check your API key in the AI Assistant settings.',
      'GROQ_RATE_LIMIT':      '⚠️ **Rate limit hit.** Groq free tier allows 30 req/min. Wait a moment and try again.'
    };
    const friendly = userErrors[err.message] || `⚠️ AI service error: ${err.message}`;
    res.status(500).json({ error: friendly });
  }
};

router.post('/daily-brief', handleDailySummary);
router.post('/daily-summary', handleDailySummary);

// ─────────────────────────────────────────────────────────────
// GET /api/ai/history
// ─────────────────────────────────────────────────────────────
router.get('/history', (req, res) => {
  const db = readDB();
  res.json((db.chatHistory || []).slice(-50));
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/ai/history
// ─────────────────────────────────────────────────────────────
router.delete('/history', (req, res) => {
  const db = readDB();
  db.chatHistory = [];
  writeDB(db);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// GET /api/ai/suggestions  (rule-based, always works)
// ─────────────────────────────────────────────────────────────
router.get('/suggestions', (req, res) => {
  const db = readDB();
  const { insights, suggestions, warnings, score } = analyzeHealthData(db.profile, db.healthLogs || []);
  res.json({ insights, suggestions, warnings, score, generatedAt: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// GET /api/ai/status  (check if API key is configured)
// ─────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const hasKey = !!(req.headers['x-groq-key']) && req.headers['x-groq-key'] !== 'your-groq-key-here';
  res.json({
    provider:        'Groq (free)',
    model:           GROQ_MODEL,
    apiKeyConfigured: hasKey,
    message:         hasKey ? '✅ Groq API ready' : '⚠️ Enter GROQ_API_KEY in the app — get free key at console.groq.com'
  });
});



// ─────────────────────────────────────────────────────────────
// GET /api/ai/dashboard  (unified AI coordinator)
// ─────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const db = readDB();
  const { profile, healthLogs = [], goals = [], streaks = {}, routineAnalyses = [], chatHistory = [], achievements = [] } = db;
  const analysis = analyzeHealthData(profile, healthLogs);
  const latestLog = healthLogs.length ? healthLogs[healthLogs.length - 1] : null;
  const latestRoutine = routineAnalyses.length ? routineAnalyses[0] : null;

  const sleepTarget = profile ? 7.5 : 8;
  const waterTarget = profile ? Math.max(2, Math.round(profile.weight * 0.033 * 10) / 10) : 2.5;
  const exerciseTarget = profile?.activityLevel === 'active' || profile?.activityLevel === 'very_active' ? 45 : 30;

  res.json({
    overview: {
      score: analysis.score,
      summary: analysis.insights?.[0] || 'AI overview generated from your profile and recent logs.',
      priorities: (analysis.suggestions || []).slice(0, 4),
      warnings: analysis.warnings || [],
      streaks,
      achievementsCount: achievements.length,
      goalsCount: goals.length
    },
    tracker: {
      dailyFocus: (analysis.suggestions || [])[0] || 'Log sleep, water, meals, and movement so the AI can refine your plan.',
      sleepTarget,
      waterTarget,
      exerciseTarget,
      latestLog,
      totalLogs: healthLogs.length,
      lastUpdate: latestLog?.updatedAt || null,
      exerciseSessionsToday: latestLog ? collectExerciseSessions(latestLog).length : 0,
      exerciseMinutesToday: latestLog ? collectExerciseSessions(latestLog).reduce((s, session) => s + (Number(session.duration) || 0), 0) : 0,
      exerciseCaloriesToday: latestLog ? collectExerciseSessions(latestLog).reduce((s, session) => s + (Number(session.caloriesBurned) || 0), 0) : 0
    },
    insights: {
      biometrics: analysis.biometrics || null,
      trends: analysis.trends || null,
      recommendations: analysis.recommendations || [],
      score: analysis.score
    },
    routine: {
      latestAnalysis: latestRoutine?.analysis || null,
      historyCount: routineAnalyses.length
    },
    assistant: {
      recentMessages: chatHistory.slice(-6),
      hasProfile: !!profile
    },
    generatedAt: new Date().toISOString()
  });
});

module.exports = router;
