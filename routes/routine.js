const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const { URL } = require('url');
const { readDB, writeDB } = require('../utils/db');
const { analyzeRoutine: fallbackAnalyzeRoutine } = require('../utils/aiEngine');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function requestJson(url, options = {}) {
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
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              try {
                return JSON.parse(body || '{}');
              } catch {
                return {};
              }
            },
            text: async () => body
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function hasGroqKey(apiKey) {
  return !!apiKey && apiKey !== 'your-groq-key-here';
}

function clampScore(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty AI response');
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();

  try {
    return JSON.parse(candidate);
  } catch { }

  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(candidate.slice(first, last + 1));
  }

  throw new Error('AI did not return valid JSON');
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(safeText).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return safeText(
      value.text ??
      value.message ??
      value.title ??
      value.action ??
      value.detail ??
      value.fix ??
      value.name ??
      value.label ??
      value.value ??
      value.type ??
      value.summary ??
      JSON.stringify(value)
    );
  }
  return String(value);
}

function normalizeObjectList(list, fallback = []) {
  const candidate = Array.isArray(list) ? list : [];
  if (!candidate.length) return fallback;
  return candidate.map((item) => (item && typeof item === 'object' ? item : { message: safeText(item) }));
}

function normalizeActivities(parsedActivities, fallbackActivities) {
  const candidate = Array.isArray(parsedActivities) ? parsedActivities : [];
  if (!candidate.length) return fallbackActivities;

  return candidate.slice(0, 40).map((item) => ({
    line: safeText(item.line).slice(0, 220),
    category: ['sleep', 'exercise', 'meal', 'work', 'leisure', 'selfCare', 'commute', 'other'].includes(item.category)
      ? item.category
      : 'other',
    hour: Number.isFinite(Number(item.hour)) ? Number(item.hour) : null,
    priority: [1, 2, 3, 4, 5].includes(Number(item.priority)) ? Number(item.priority) : 3
  }));
}

function sanitizeAnalysisPayload(parsed, fallback) {
  const positives = normalizeObjectList(parsed?.positives, fallback.positives).map((item) => ({
    icon: safeText(item.icon || '✅') || '✅',
    message: safeText(item.message || item.detail || item.title || item.action || item)
  })).filter((item) => item.message);

  const issues = normalizeObjectList(parsed?.issues, fallback.issues).map((item) => ({
    severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium',
    icon: safeText(item.icon || '⚠️') || '⚠️',
    title: safeText(item.title || item.message || item.detail || 'Issue'),
    detail: safeText(item.detail || item.message || item.title || ''),
    fix: safeText(item.fix || item.action || item.message || '')
  })).filter((item) => item.title || item.detail || item.fix);

  const suggestions = normalizeObjectList(parsed?.suggestions, fallback.suggestions).map((item) => ({
    icon: safeText(item.icon || '💡') || '💡',
    title: safeText(item.title || item.message || item.detail || 'Suggestion'),
    detail: safeText(item.detail || item.message || item.title || ''),
    fix: safeText(item.fix || item.action || item.message || '')
  })).filter((item) => item.title || item.detail || item.fix);

  const actionPlan = normalizeObjectList(parsed?.actionPlan, fallback.actionPlan).map((item) => ({
    time: safeText(item.time || item.title || item.icon || 'Plan'),
    action: safeText(item.action || item.message || item.detail || item.title || item.fix || item)
  })).filter((item) => item.time || item.action);

  return {
    routineScore: clampScore(parsed?.routineScore ?? parsed?.score ?? fallback.routineScore, fallback.routineScore),
    summary: safeText(parsed?.summary || fallback.summary),
    positives: positives.length ? positives : fallback.positives,
    issues: issues.length ? issues : fallback.issues,
    suggestions: suggestions.length ? suggestions : fallback.suggestions,
    activities: normalizeActivities(parsed?.activities, fallback.activities),
    actionPlan: actionPlan.length ? actionPlan : fallback.actionPlan,
    aiMode: 'groq',
    aiModel: GROQ_MODEL
  };
}

function summarizeHealthContext(db) {
  const profile = db.profile || {};
  const logs = db.healthLogs || [];
  const recent = logs.slice(-7);

  const avg = (key) => {
    const vals = recent
      .map((row) => Number(row[key]))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (!vals.length) return null;
    return (vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(1);
  };

  const activeDays = recent.filter((row) => Number(row?.exercise?.duration || 0) > 0).length;
  const lastWeight = [...logs].reverse().find((row) => row.weight != null)?.weight ?? null;

  return [
    `Profile: age=${profile.age ?? 'unknown'}, gender=${profile.gender ?? 'unknown'}, height=${profile.height ?? 'unknown'}cm, weight=${profile.weight ?? 'unknown'}kg, goal=${profile.goal ?? 'unknown'}, targetWeight=${profile.targetWeight ?? 'unknown'}kg, activityLevel=${profile.activityLevel ?? 'unknown'}.`,
    `Recent 7-day averages: sleep=${avg('sleep') ?? 'n/a'}h, water=${avg('water') ?? 'n/a'}L, mood=${avg('mood') ?? 'n/a'}/10, activeDays=${activeDays}/7, lastWeight=${lastWeight ?? 'n/a'}kg.`,
    `Current goals: ${(db.goals || []).slice(0, 5).map((g) => g.title || g.name || g.goal || 'goal').join(', ') || 'none'}.`
  ].join('\n');
}

function buildRoutineHistoryContext(db) {
  const analyses = Array.isArray(db.routineAnalyses) ? db.routineAnalyses.slice(0, 5) : [];
  if (!analyses.length) {
    return 'Previous routine history: none available.';
  }

  return analyses.map((entry, index) => {
    const score = entry?.analysis?.routineScore ?? entry?.analysis?.score ?? 'n/a';
    const summary = safeText(entry?.analysis?.summary || '');
    const routine = safeText(entry?.routineText || '').slice(0, 900);
    const createdAt = entry?.createdAt ? new Date(entry.createdAt).toISOString() : 'unknown';
    return `Routine history item ${index + 1}:
- createdAt: ${createdAt}
- score: ${score}
- summary: ${summary || 'n/a'}
- routine:
${routine}`;
  }).join('\n\n');
}

function buildRoutineSystemPrompt(db) {
  return `
You are an expert routine analyst for health, recovery, and muscle gain.
Analyze the user's uploaded routine together with their current health context and previous logged routines.
Return ONLY valid JSON. Do not wrap it in markdown.

JSON schema:
{
  "routineScore": 0-100 integer,
  "summary": "1-2 sentence assessment",
  "positives": [
    { "icon": "✅", "message": "string" }
  ],
  "issues": [
    {
      "severity": "low|medium|high",
      "icon": "string",
      "title": "string",
      "detail": "string",
      "fix": "string"
    }
  ],
  "suggestions": [
    {
      "icon": "string",
      "title": "string",
      "detail": "string",
      "fix": "string"
    }
  ],
  "activities": [
    {
      "line": "original routine line",
      "category": "sleep|exercise|meal|work|leisure|selfCare|commute|other",
      "hour": 0-23 or null,
      "priority": 1-5
    }
  ],
  "actionPlan": [
    { "time": "string", "action": "string" }
  ]
}

Rules:
- Focus on sleep timing, meal spacing, hydration, exercise consistency, screen time, and recovery.
- If the profile suggests underweight or muscle gain, prioritize calorie density, protein distribution, and strength training consistency.
- Compare the current uploaded routine against previous stored routines and note whether it is improving or worsening.
- Be specific and practical.
- Keep the answer concise but high quality.
- No markdown, no commentary, JSON only.

Health context:
${summarizeHealthContext(db)}

Previous routine history:
${buildRoutineHistoryContext(db)}
`.trim();
}

function buildRoutineUserPrompt(routineText, db) {
  const recentLogs = (db.healthLogs || []).slice(-10);
  const recentRoutineSnippets = (db.routineAnalyses || []).slice(0, 5).map((entry, index) => {
    const score = entry?.analysis?.routineScore ?? entry?.analysis?.score ?? 'n/a';
    const summary = safeText(entry?.analysis?.summary || '');
    return `Old routine ${index + 1} (score ${score}): ${summary}\n${safeText(entry?.routineText || '').slice(0, 700)}`;
  });

  const healthLogText = recentLogs.map((log, index) => {
    const meals = Array.isArray(log.meals) ? log.meals.map((m) => safeText(m.name || m)).join(' | ') : '';
    return `Log ${index + 1}: date=${log.date || 'unknown'}, sleep=${log.sleep ?? 'n/a'}, water=${log.water ?? 'n/a'}, mood=${log.mood ?? 'n/a'}, exercise=${safeText(log?.exercise?.type || '')} ${log?.exercise?.duration ?? 'n/a'}min, meals=${meals || 'none'}, notes=${safeText(log.notes || '')}`;
  }).join('\n');

  return `
Routine text to analyze:
${routineText}

Old stored routine context:
${recentRoutineSnippets.length ? recentRoutineSnippets.join('\n\n') : 'No earlier routine uploads were found.'}

Recent health log context:
${healthLogText || 'No health logs available.'}
`.trim();
}

async function callGroq(messages, systemPrompt, apiKey) {
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
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
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
  return data.choices?.[0]?.message?.content || '';
}

function buildFallbackAnalysis(routineText, profile) {
  const analysis = fallbackAnalyzeRoutine(routineText, profile);
  return {
    routineScore: clampScore(analysis.routineScore ?? analysis.score ?? 50, 50),
    summary: safeText(analysis.summary || 'Routine analyzed using rule-based fallback.'),
    positives: Array.isArray(analysis.positives)
      ? analysis.positives.map((item) => ({
        icon: safeText(item.icon || '✅') || '✅',
        message: safeText(item.message || item.title || item.detail || item)
      })).filter((item) => item.message)
      : [],
    issues: Array.isArray(analysis.issues)
      ? analysis.issues.map((item) => ({
        severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium',
        icon: safeText(item.icon || '⚠️') || '⚠️',
        title: safeText(item.title || item.message || item.detail || 'Issue'),
        detail: safeText(item.detail || item.message || item.title || ''),
        fix: safeText(item.fix || item.action || item.message || '')
      })).filter((item) => item.title || item.detail || item.fix)
      : [],
    suggestions: Array.isArray(analysis.suggestions)
      ? analysis.suggestions.map((item) => ({
        icon: safeText(item.icon || '💡') || '💡',
        title: safeText(item.title || item.message || item.detail || 'Suggestion'),
        detail: safeText(item.detail || item.message || item.title || ''),
        fix: safeText(item.fix || item.action || item.message || '')
      })).filter((item) => item.title || item.detail || item.fix)
      : [],
    activities: Array.isArray(analysis.activities)
      ? normalizeActivities(analysis.activities, [])
      : [],
    actionPlan: Array.isArray(analysis.actionPlan)
      ? analysis.actionPlan.map((item) => ({
        time: safeText(item.time || item.title || 'Plan'),
        action: safeText(item.action || item.message || item.detail || item.title || item.fix || item)
      })).filter((item) => item.time || item.action)
      : [],
    aiMode: 'fallback'
  };
}

// POST — analyze routine text with AI
router.post('/analyze', async (req, res) => {
  const { routineText } = req.body;
  const apiKey = req.headers['x-groq-key'];

  if (!routineText || routineText.trim().length < 20) {
    return res.status(400).json({ error: 'Please provide a more detailed routine (at least 20 characters).' });
  }

  const db = readDB();
  const profile = db.profile || {};
  const fallback = buildFallbackAnalysis(routineText, profile);

  let analysis = fallback;
  let aiText = null;
  let aiMode = 'fallback';

  try {
    if (hasGroqKey(apiKey)) {
      aiText = await callGroq(
        [{ role: 'user', content: buildRoutineUserPrompt(routineText, db) }],
        buildRoutineSystemPrompt(db),
        apiKey
      );

      const parsed = safeJsonParse(aiText);
      analysis = sanitizeAnalysisPayload(parsed, fallback);
      aiMode = 'groq';
    }
  } catch (err) {
    console.error('Routine AI error:', err.message);
    analysis = {
      ...fallback,
      aiMode: 'fallback',
      aiError: err.message
    };
    aiMode = 'fallback';
  }

  const record = {
    id: uuidv4(),
    routineText,
    analysis,
    aiMode,
    aiText,
    createdAt: new Date().toISOString()
  };

  db.routineAnalyses = db.routineAnalyses || [];
  db.routineAnalyses.unshift(record);
  if (db.routineAnalyses.length > 20) db.routineAnalyses = db.routineAnalyses.slice(0, 20);

  writeDB(db);
  res.json(record);
});

// GET — history of analyses
router.get('/history', (req, res) => {
  const db = readDB();
  res.json((db.routineAnalyses || []).slice(0, 10));
});

// GET — AI status for routine analyzer
router.get('/status', (req, res) => {
  const apiKey = req.headers['x-groq-key'];
  res.json({
    aiEnabled: hasGroqKey(apiKey),
    model: GROQ_MODEL,
    mode: hasGroqKey(apiKey) ? 'groq' : 'fallback'
  });
});

module.exports = router;
