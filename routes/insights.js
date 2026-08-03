const express = require('express');
const router = express.Router();
const { readDB } = require('../utils/db');
const {
  analyzeHealthData,
  calculateBMI,
  getBMICategory,
  calculateBMR,
  calculateTDEE,
  calculateIdealWeightRange,
  calculateWaterNeeds,
  calculateMacroTargets,
  linearRegression,
  rollingAverage,
  detectAnomalies,
  computeWeeklyProgress,
  computeAchievements
} = require('../utils/aiEngine');

// GET full insights dashboard
router.get('/', (req, res) => {
  const db = readDB();
  const { profile, healthLogs = [], streaks = {} } = db;

  // Full AI analysis
  const analysis = analyzeHealthData(profile, healthLogs);

  // Per-metric weekly progress
  const sleepProgress = computeWeeklyProgress(healthLogs, 'sleep');
  const waterProgress = computeWeeklyProgress(healthLogs, 'water');
  const weightProgress = computeWeeklyProgress(healthLogs, 'weight');

  // Weight trend (linear regression over 30 days)
  const recentWeights = healthLogs.filter(l => l.weight).slice(-30);
  const weightRegression = linearRegression(recentWeights.map(l => l.weight));
  const weeklyWeightChange = parseFloat((weightRegression.slope * 7).toFixed(2));

  // Sleep trend
  const sleepVals = healthLogs.map(l => l.sleep).filter(v => v > 0);
  const sleepRolling = rollingAverage(sleepVals, 7);

  // Anomaly detection
  const weightVals = healthLogs.filter(l => l.weight).map(l => l.weight);
  const weightAnomalies = detectAnomalies(weightVals);

  // Biometrics (if profile exists)
  let biometrics = null;
  if (profile) {
    const activeDays = healthLogs.slice(-7).filter(l => l.exercise?.duration > 0).length;
    const bmi = calculateBMI(profile.weight, profile.height);
    const bmiCat = getBMICategory(bmi);
    const bmr = calculateBMR(profile);
    const tdee = calculateTDEE(profile, activeDays);
    const idealRange = calculateIdealWeightRange(profile.height, profile.gender);
    const waterNeeds = calculateWaterNeeds(
      profile.weight,
      healthLogs.slice(-7).reduce((s, l) => s + (l.exercise?.duration || 0), 0) / 7
    );
    const macros = calculateMacroTargets(profile, 'maintain', tdee);

    biometrics = {
      bmi,
      bmiCategory: bmiCat,
      bmr,
      tdee,
      idealWeightRange: idealRange,
      dailyWaterNeed: waterNeeds,
      macroTargets: macros
    };
  }

  // Achievements
  const achievements = computeAchievements(streaks, healthLogs, profile);

  res.json({
    analysis,
    biometrics,
    trends: {
      sleep: sleepProgress,
      water: waterProgress,
      weight: weightProgress,
      weeklyWeightChange,
      weightRegression,
      weightAnomalies
    },
    streaks,
    achievements,
    totalLogs: healthLogs.length,
    generatedAt: new Date().toISOString()
  });
});

// GET biometrics only
router.get('/biometrics', (req, res) => {
  const db = readDB();
  const { profile, healthLogs = [] } = db;

  if (!profile) return res.status(404).json({ error: 'Profile not set up yet' });

  const activeDays = healthLogs.slice(-7).filter(l => l.exercise?.duration > 0).length;
  const bmi = calculateBMI(profile.weight, profile.height);
  const tdee = calculateTDEE(profile, activeDays);

  res.json({
    bmi,
    bmiCategory: getBMICategory(bmi),
    bmr: calculateBMR(profile),
    tdee,
    idealWeightRange: calculateIdealWeightRange(profile.height, profile.gender),
    dailyWaterNeed: calculateWaterNeeds(profile.weight),
    macroTargets: calculateMacroTargets(profile, 'maintain', tdee)
  });
});

module.exports = router;
