const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../utils/db');
const { updateStreak, computeAchievements, analyzeHealthData, analyzeExerciseSession } = require('../utils/aiEngine');

const DEFAULT_EXERCISE = { type: '', name: '', duration: 0, intensity: 'moderate' };

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeExercise = (exercise, fallback = DEFAULT_EXERCISE) => {
  const src = exercise && typeof exercise === 'object' ? exercise : {};
  const type = typeof src.type === 'string' ? src.type.trim() : '';
  const name = typeof src.name === 'string' ? src.name.trim() : '';
  const duration = toNumberOrNull(src.duration);
  const intensity = ['light', 'moderate', 'intense'].includes(src.intensity) ? src.intensity : fallback.intensity || 'moderate';

  return {
    type: type || fallback.type || '',
    name: name || fallback.name || '',
    duration: duration !== null ? duration : Number(fallback.duration || 0),
    intensity
  };
};

const hasMeaningfulExercise = (exercise) => {
  if (!exercise || typeof exercise !== 'object') return false;
  return Boolean(
    (typeof exercise.type === 'string' && exercise.type.trim()) ||
    (typeof exercise.name === 'string' && exercise.name.trim()) ||
    Number(exercise.duration) > 0 ||
    (typeof exercise.intensity === 'string' && exercise.intensity.trim())
  );
};

const appendUniqueExerciseSnapshot = (history, exercise) => {
  const next = Array.isArray(history) ? [...history] : [];
  const last = next[next.length - 1];
  const candidate = {
    type: exercise.type || '',
    name: exercise.name || '',
    duration: Number(exercise.duration) || 0,
    intensity: exercise.intensity || 'moderate',
    caloriesBurned: Number(exercise.caloriesBurned) || 0,
    savedAt: new Date().toISOString()
  };

  const isDuplicate =
    last &&
    last.type === candidate.type &&
    Number(last.duration) === candidate.duration &&
    last.intensity === candidate.intensity;

  if (!isDuplicate && (candidate.type || candidate.duration > 0 || candidate.intensity)) {
    next.push(candidate);
  }

  return next.slice(-30);
};


const sumExerciseCalories = (history = []) => history.reduce((sum, item) => sum + (Number(item?.caloriesBurned) || 0), 0);

// GET all health logs (optional: ?days=30 filter)
router.get('/', (req, res) => {
  const db = readDB();
  let logs = db.healthLogs || [];

  if (req.query.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(req.query.days));
    logs = logs.filter(l => new Date(l.date) >= cutoff);
  }

  res.json(logs.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

// GET today's log
router.get('/today', (req, res) => {
  const db = readDB();
  const today = new Date().toDateString();
  const todayLog = (db.healthLogs || []).find(l => new Date(l.date).toDateString() === today);
  res.json(todayLog || null);
});

// GET streaks
router.get('/streaks', (req, res) => {
  const db = readDB();
  res.json(db.streaks || { currentStreak: 0, longestStreak: 0, totalLoggedDays: 0 });
});

// POST new log entry (or update today's)
router.post('/', (req, res) => {
  const {
    date,
    sleep,        // hours (number)
    water,        // liters (number)
    weight,       // kg (number)
    exercise,     // { type, duration (min), intensity }
    meals,        // [{ name, calories, protein, carbs, fat, time }]
    mood,         // 1-10
    notes         // string
  } = req.body;

  const db = readDB();
  const logs = db.healthLogs || [];
  const logDate = date ? new Date(date) : new Date();
  const dayStr = logDate.toDateString();

  // Find existing log for this day
  const existingIdx = logs.findIndex(l => new Date(l.date).toDateString() === dayStr);
  const existingLog = existingIdx >= 0 ? logs[existingIdx] : null;

  const previousExercise = existingLog?.exercise || DEFAULT_EXERCISE;
  const previousExerciseHistory = existingLog?.exerciseHistory || [];

  const normalizedIncomingExercise = normalizeExercise(exercise, previousExercise);
  const hasIncomingExercise = hasMeaningfulExercise(exercise);

  const currentExercise = hasIncomingExercise
    ? normalizedIncomingExercise
    : normalizeExercise(previousExercise, DEFAULT_EXERCISE);

  const exerciseHistory = hasIncomingExercise
    ? appendUniqueExerciseSnapshot(previousExerciseHistory, currentExercise)
    : previousExerciseHistory;

  const exerciseAnalysis = hasMeaningfulExercise(currentExercise)
    ? analyzeExerciseSession(db.profile || {}, currentExercise, {
        hasHistoricalExercise: exerciseHistory.length > 0
      })
    : (existingLog?.exerciseAnalysis || null);

  const exerciseCaloriesBurnedTotal = hasMeaningfulExercise(currentExercise)
    ? sumExerciseCalories(exerciseHistory)
    : (existingLog?.exerciseCaloriesBurned || 0);

  const logEntry = {
    id: existingIdx >= 0 ? logs[existingIdx].id : uuidv4(),
    date: logDate.toISOString(),
    sleep: sleep !== undefined ? parseFloat(sleep) : existingIdx >= 0 ? logs[existingIdx].sleep : 0,
    water: water !== undefined ? parseFloat(water) : existingIdx >= 0 ? logs[existingIdx].water : 0,
    weight: weight !== undefined ? parseFloat(weight) : existingIdx >= 0 ? logs[existingIdx].weight : null,
    exercise: currentExercise,
    exerciseHistory,
    exerciseAnalysis,
    exerciseCaloriesBurned: exerciseCaloriesBurnedTotal,
    exerciseCaloriesBurnedCurrent: currentExercise?.caloriesBurned || 0,
    exerciseCaloriesBurnedTotal,
    meals: meals || (existingIdx >= 0 ? logs[existingIdx].meals : []),
    mood: mood !== undefined ? parseInt(mood) : existingIdx >= 0 ? logs[existingIdx].mood : null,
    notes: notes || (existingIdx >= 0 ? logs[existingIdx].notes : ''),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    logs[existingIdx] = logEntry;
  } else {
    logs.push(logEntry);
  }

  // Sort by date
  logs.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Update streak
  const isToday = dayStr === new Date().toDateString();
  if (isToday) {
    db.streaks = updateStreak(db.streaks || {}, db.streaks?.lastLogDate);
  }

  // Compute achievements
  db.achievements = computeAchievements(db.streaks, logs, db.profile);

  db.healthLogs = logs;
  writeDB(db);

  const aiDashboard = analyzeHealthData(db.profile, db.healthLogs || []);

  res.json({
    success: true,
    log: logEntry,
    streaks: db.streaks,
    achievements: db.achievements,
    aiDashboard
  });
});


// POST exercise only (explicit save button)
router.post('/exercise', (req, res) => {
  const { date, exercise, intensity, duration, name } = req.body;
  const db = readDB();
  const logs = db.healthLogs || [];
  const logDate = date ? new Date(date) : new Date();
  const dayStr = logDate.toDateString();

  const existingIdx = logs.findIndex(l => new Date(l.date).toDateString() === dayStr);
  const existingLog = existingIdx >= 0 ? logs[existingIdx] : null;

  const previousExercise = existingLog?.exercise || DEFAULT_EXERCISE;
  const normalizedIncomingExercise = normalizeExercise({
    ...exercise,
    intensity: intensity ?? exercise?.intensity,
    duration: duration ?? exercise?.duration,
    name: name ?? exercise?.name
  }, previousExercise);

  const exerciseAnalysis = analyzeExerciseSession(db.profile || {}, normalizedIncomingExercise, {
    hasHistoricalExercise: (existingLog?.exerciseHistory || []).length > 0
  });

  const exerciseWithCalories = {
    ...normalizedIncomingExercise,
    caloriesBurned: exerciseAnalysis.caloriesBurned
  };

  const exerciseHistory = appendUniqueExerciseSnapshot(existingLog?.exerciseHistory || [], exerciseWithCalories);
  const exerciseCaloriesBurnedTotal = sumExerciseCalories(exerciseHistory);

  const logEntry = {
    id: existingIdx >= 0 ? logs[existingIdx].id : uuidv4(),
    date: logDate.toISOString(),
    sleep: existingLog?.sleep || 0,
    water: existingLog?.water || 0,
    weight: existingLog?.weight || null,
    exercise: exerciseWithCalories,
    exerciseHistory,
    exerciseAnalysis,
    exerciseCaloriesBurned: exerciseCaloriesBurnedTotal,
    exerciseCaloriesBurnedCurrent: exerciseAnalysis.caloriesBurned,
    exerciseCaloriesBurnedTotal,
    meals: existingLog?.meals || [],
    mood: existingLog?.mood || null,
    notes: existingLog?.notes || '',
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) logs[existingIdx] = logEntry;
  else logs.push(logEntry);

  logs.sort((a, b) => new Date(a.date) - new Date(b.date));

  db.healthLogs = logs;
  db.exerciseAnalyses = db.exerciseAnalyses || [];
  db.exerciseAnalyses.unshift({
    id: uuidv4(),
    date: logEntry.date,
    exercise: exerciseWithCalories,
    analysis: exerciseAnalysis,
    createdAt: new Date().toISOString()
  });
  db.exerciseAnalyses = db.exerciseAnalyses.slice(0, 50);

  db.achievements = computeAchievements(db.streaks || {}, logs, db.profile);
  const aiDashboard = analyzeHealthData(db.profile, db.healthLogs || []);
  writeDB(db);

  res.json({
    success: true,
    log: logEntry,
    exerciseAnalysis,
    aiDashboard
  });
});

// DELETE a log entry
router.delete('/:id', (req, res) => {
  const db = readDB();
  db.healthLogs = (db.healthLogs || []).filter(l => l.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// GET summary stats (for dashboard)
router.get('/summary', (req, res) => {
  const db = readDB();
  const logs = db.healthLogs || [];
  const last7 = logs.slice(-7);
  const last30 = logs.slice(-30);

  const avg = (arr, key) => {
    const vals = arr.map(l => l[key]).filter(v => v > 0);
    return vals.length ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)) : 0;
  };

  const totalCals7 = last7.map(l =>
    (l.meals || []).reduce((s, m) => s + (m.calories || 0), 0)
  );
  const avgCals = totalCals7.length ?
    Math.round(totalCals7.reduce((s, v) => s + v, 0) / totalCals7.filter(v => v > 0).length || 0) : 0;

  res.json({
    last7Days: {
      avgSleep: avg(last7, 'sleep'),
      avgWater: avg(last7, 'water'),
      avgWeight: avg(last7, 'weight'),
      avgCalories: avgCals,
      activeDays: last7.filter(l => l.exercise?.duration > 0).length,
      totalExerciseMin: last7.reduce((s, l) => s + (l.exercise?.duration || 0), 0),
      avgMood: avg(last7, 'mood')
    },
    last30Days: {
      avgSleep: avg(last30, 'sleep'),
      avgWater: avg(last30, 'water'),
      totalLogs: logs.length
    },
    weightHistory: logs.filter(l => l.weight).map(l => ({ date: l.date, weight: l.weight })),
    sleepHistory: logs.map(l => ({ date: l.date, sleep: l.sleep })),
    waterHistory: logs.map(l => ({ date: l.date, water: l.water })),
    moodHistory: logs.filter(l => l.mood).map(l => ({ date: l.date, mood: l.mood }))
  });
});

module.exports = router;
