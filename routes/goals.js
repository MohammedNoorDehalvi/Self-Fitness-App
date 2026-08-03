const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../utils/db');

const GOAL_TYPES = ['lose_weight', 'gain_weight', 'improve_sleep', 'increase_water', 'exercise_more', 'maintain_weight', 'build_muscle', 'reduce_stress'];

// GET all goals
router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.goals || []);
});

// POST — create goal
router.post('/', (req, res) => {
  const { type, target, deadline, unit, description } = req.body;

  if (!type || !target) {
    return res.status(400).json({ error: 'type and target are required' });
  }

  const db = readDB();
  db.goals = db.goals || [];

  const goal = {
    id: uuidv4(),
    type,
    target: parseFloat(target),
    unit: unit || '',
    deadline: deadline || null,
    description: description || '',
    startValue: null,
    currentValue: null,
    achieved: false,
    createdAt: new Date().toISOString()
  };

  // Auto-fill start value from latest health log
  const logs = db.healthLogs || [];
  if (logs.length > 0) {
    const latest = logs[logs.length - 1];
    if (type === 'lose_weight' || type === 'gain_weight' || type === 'maintain_weight' || type === 'build_muscle') {
      goal.startValue = latest.weight || db.profile?.weight;
      goal.currentValue = goal.startValue;
    } else if (type === 'improve_sleep') {
      const sleepVals = logs.slice(-7).map(l => l.sleep).filter(v => v > 0);
      goal.startValue = sleepVals.length ? (sleepVals.reduce((s, v) => s + v, 0) / sleepVals.length) : null;
      goal.currentValue = goal.startValue;
    } else if (type === 'increase_water') {
      const waterVals = logs.slice(-7).map(l => l.water).filter(v => v > 0);
      goal.startValue = waterVals.length ? (waterVals.reduce((s, v) => s + v, 0) / waterVals.length) : null;
      goal.currentValue = goal.startValue;
    }
  }

  db.goals.push(goal);
  writeDB(db);
  res.json({ success: true, goal });
});

// PUT — update goal progress
router.put('/:id', (req, res) => {
  const db = readDB();
  const idx = (db.goals || []).findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });

  db.goals[idx] = { ...db.goals[idx], ...req.body, id: req.params.id };

  // Check if achieved
  const goal = db.goals[idx];
  if (goal.type === 'lose_weight' && goal.currentValue <= goal.target) goal.achieved = true;
  if (goal.type === 'gain_weight' && goal.currentValue >= goal.target) goal.achieved = true;
  if (goal.type === 'improve_sleep' && goal.currentValue >= goal.target) goal.achieved = true;
  if (goal.type === 'increase_water' && goal.currentValue >= goal.target) goal.achieved = true;

  writeDB(db);
  res.json({ success: true, goal: db.goals[idx] });
});

// DELETE goal
router.delete('/:id', (req, res) => {
  const db = readDB();
  db.goals = (db.goals || []).filter(g => g.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// GET progress report
router.get('/progress', (req, res) => {
  const db = readDB();
  const goals = db.goals || [];
  const logs = db.healthLogs || [];

  // Auto-update goal current values from logs
  const last7 = logs.slice(-7);
  const updatedGoals = goals.map(goal => {
    let currentValue = goal.currentValue;

    if (['lose_weight', 'gain_weight', 'maintain_weight', 'build_muscle'].includes(goal.type)) {
      const wt = logs.filter(l => l.weight).slice(-1)[0]?.weight;
      if (wt) currentValue = wt;
    } else if (goal.type === 'improve_sleep') {
      const vals = last7.map(l => l.sleep).filter(v => v > 0);
      if (vals.length) currentValue = parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
    } else if (goal.type === 'increase_water') {
      const vals = last7.map(l => l.water).filter(v => v > 0);
      if (vals.length) currentValue = parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
    } else if (goal.type === 'exercise_more') {
      currentValue = last7.reduce((s, l) => s + (l.exercise?.duration || 0), 0);
    }

    // Progress % calculation
    let progress = 0;
    if (goal.startValue !== null && goal.target !== goal.startValue) {
      if (['lose_weight'].includes(goal.type)) {
        progress = ((goal.startValue - currentValue) / (goal.startValue - goal.target)) * 100;
      } else {
        progress = ((currentValue - goal.startValue) / (goal.target - goal.startValue)) * 100;
      }
    }

    return { ...goal, currentValue, progress: Math.max(0, Math.min(100, Math.round(progress))) };
  });

  res.json(updatedGoals);
});

module.exports = router;
