/**
 * ============================================================
 * AI ENGINE — Rule-Based Health Intelligence System
 * ============================================================
 * This module powers all health analysis, recommendations,
 * pattern detection, and chatbot responses without any
 * external ML dependencies.
 * ============================================================
 */

// ─────────────────────────────────────────────
// SECTION 1: CORE BIOMETRIC CALCULATIONS
// ─────────────────────────────────────────────

/**
 * Calculate BMI using standard WHO formula
 * @param {number} weight - kg
 * @param {number} height - cm
 */
const calculateBMI = (weight, height) => {
  const heightM = height / 100;
  return parseFloat((weight / (heightM * heightM)).toFixed(1));
};

/**
 * Classify BMI into WHO categories
 */
const getBMICategory = (bmi) => {
  if (bmi < 16.0) return { label: 'Severe Thinness', color: '#ef4444', risk: 'very-high' };
  if (bmi < 17.0) return { label: 'Moderate Thinness', color: '#f97316', risk: 'high' };
  if (bmi < 18.5) return { label: 'Mild Thinness', color: '#eab308', risk: 'medium' };
  if (bmi < 25.0) return { label: 'Normal Weight', color: '#22c55e', risk: 'low' };
  if (bmi < 30.0) return { label: 'Overweight', color: '#eab308', risk: 'medium' };
  if (bmi < 35.0) return { label: 'Obese Class I', color: '#f97316', risk: 'high' };
  if (bmi < 40.0) return { label: 'Obese Class II', color: '#ef4444', risk: 'very-high' };
  return { label: 'Obese Class III', color: '#7f1d1d', risk: 'extreme' };
};

/**
 * Harris-Benedict BMR + Mifflin-St Jeor cross-validation
 * Returns average of both formulas for accuracy
 * @param {object} profile - { weight, height, age, gender }
 */
const calculateBMR = (profile) => {
  const { weight, height, age, gender } = profile;

  // Harris-Benedict (1919, revised 1984)
  let bmrHB;
  if (gender === 'male') {
    bmrHB = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    bmrHB = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }

  // Mifflin-St Jeor (1990) — more accurate for modern populations
  let bmrMSJ;
  if (gender === 'male') {
    bmrMSJ = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmrMSJ = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  return Math.round((bmrHB + bmrMSJ) / 2);
};

/**
 * Total Daily Energy Expenditure using PAL multipliers
 * Activity level derived from exercise logs
 */
const calculateTDEE = (profile, weeklyActiveDays = 3) => {
  const bmr = calculateBMR(profile);
  const palMap = {
    0: 1.2,   // sedentary
    1: 1.275,
    2: 1.35,
    3: 1.425,
    4: 1.5,
    5: 1.6,
    6: 1.7,
    7: 1.9    // very active (training twice daily)
  };
  const pal = palMap[Math.min(7, Math.round(weeklyActiveDays))];
  return Math.round(bmr * pal);
};

/**
 * Ideal weight range using multiple formulas (Devine, Robinson, Miller)
 * Returns min and max of the consensus range
 */
const calculateIdealWeightRange = (height, gender) => {
  const heightInches = (height - 152.4) / 2.54; // inches above 5 feet

  const devine = gender === 'male'
    ? 50 + 2.3 * heightInches
    : 45.5 + 2.3 * heightInches;

  const robinson = gender === 'male'
    ? 52 + 1.9 * heightInches
    : 49 + 1.7 * heightInches;

  const miller = gender === 'male'
    ? 56.2 + 1.41 * heightInches
    : 53.1 + 1.36 * heightInches;

  const avg = (devine + robinson + miller) / 3;
  return {
    min: parseFloat((avg * 0.9).toFixed(1)),
    max: parseFloat((avg * 1.1).toFixed(1)),
    ideal: parseFloat(avg.toFixed(1))
  };
};

/**
 * Recommended daily water intake based on weight
 * Using European Food Safety Authority guidelines
 */
const calculateWaterNeeds = (weight, exerciseMinutes = 0) => {
  const baseNeed = weight * 0.033; // 33ml per kg
  const exerciseBonus = (exerciseMinutes / 30) * 0.35; // 350ml per 30 mins exercise
  return parseFloat((baseNeed + exerciseBonus).toFixed(1));
};

/**
 * Macronutrient targets based on goals and profile
 */
const calculateMacroTargets = (profile, goal = 'maintain', tdee) => {
  let caloricTarget;
  if (goal === 'lose') caloricTarget = tdee - 500;
  else if (goal === 'gain') caloricTarget = tdee + 300;
  else caloricTarget = tdee;

  // Protein: 1.6-2.2g/kg for active, 0.8g/kg sedentary (per meta-analysis)
  const proteinMultiplier = goal === 'gain' ? 2.2 : goal === 'lose' ? 2.0 : 1.6;
  const proteinG = Math.round(profile.weight * proteinMultiplier);
  const proteinCal = proteinG * 4;

  // Fat: 25-35% of calories
  const fatCal = Math.round(caloricTarget * 0.28);
  const fatG = Math.round(fatCal / 9);

  // Carbs: remaining calories
  const carbCal = caloricTarget - proteinCal - fatCal;
  const carbG = Math.round(carbCal / 4);

  return {
    calories: caloricTarget,
    protein: proteinG,
    carbs: carbG,
    fat: fatG,
    fiber: Math.round(caloricTarget / 1000 * 14) // 14g per 1000 kcal
  };
};


/**
 * Normalize values returned by the analysis engine to plain display-safe strings.
 */
const toText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return toText(
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
  const src = item && typeof item === 'object' ? item : { message: item };
  return {
    type: toText(src.type),
    severity: toText(src.severity),
    icon: toText(src.icon || fallbackIcon) || fallbackIcon,
    title: toText(src.title || src.name || src.label || ''),
    message: toText(src.message || src.detail || src.summary || src.title || ''),
    action: toText(src.action || src.fix || ''),
    detail: toText(src.detail || src.message || ''),
    fix: toText(src.fix || src.action || ''),
    ctaLabel: toText(src.ctaLabel || src.buttonLabel || ''),
    ctaTarget: toText(src.ctaTarget || ''),
    ctaPrompt: toText(src.ctaPrompt || ''),
    metric: src.metric,
    threshold: src.threshold,
    value: src.value
  };
};


const collectExerciseSessionsFromLog = (log = {}) => {
  const history = Array.isArray(log?.exerciseHistory) && log.exerciseHistory.length
    ? log.exerciseHistory
    : (log?.exercise && Number(log.exercise.duration) > 0 ? [log.exercise] : []);

  return history
    .map((session) => {
      const duration = Math.max(0, Number(session?.duration) || 0);
      const type = String(session?.type || session?.name || 'exercise').trim();
      const name = String(session?.name || session?.type || '').trim();
      const intensity = String(session?.intensity || log?.exercise?.intensity || 'moderate').toLowerCase();
      const caloriesBurned = Math.max(0, Number(session?.caloriesBurned) || 0);

      return {
        type,
        name,
        duration,
        intensity,
        caloriesBurned
      };
    })
    .filter((session) => session.duration > 0 || session.type || session.name);
};

const sumExerciseStats = (logs = []) => {
  const sessions = logs.flatMap((log) => collectExerciseSessionsFromLog(log));
  const activeDays = logs.filter((log) => collectExerciseSessionsFromLog(log).length > 0).length;
  const totalMinutes = sessions.reduce((sum, session) => sum + (Number(session.duration) || 0), 0);
  const totalCalories = sessions.reduce((sum, session) => sum + (Number(session.caloriesBurned) || 0), 0);

  return {
    sessions,
    sessionCount: sessions.length,
    activeDays,
    totalMinutes,
    totalCalories
  };
};

// ─────────────────────────────────────────────
// SECTION 2: TREND & PATTERN ANALYSIS
// ─────────────────────────────────────────────

/**
 * Linear regression for trend line calculation
 * Returns slope, intercept, R² (coefficient of determination)
 */
const linearRegression = (data) => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  data.forEach((y, x) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  const ssTot = data.reduce((s, y) => s + Math.pow(y - yMean, 2), 0);
  const ssRes = data.reduce((s, y, x) => s + Math.pow(y - (slope * x + intercept), 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);

  return { slope: parseFloat(slope.toFixed(4)), intercept: parseFloat(intercept.toFixed(2)), r2: parseFloat(r2.toFixed(3)) };
};

/**
 * Compute 7-day rolling average for any metric
 */
const rollingAverage = (data, window = 7) => {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return parseFloat((slice.reduce((s, v) => s + v, 0) / slice.length).toFixed(2));
  });
};

/**
 * Detect anomalies using Z-score method
 * Values beyond 2 standard deviations are flagged
 */
const detectAnomalies = (values) => {
  if (values.length < 3) return [];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return values.map((v, i) => ({
    index: i,
    value: v,
    zScore: stdDev ? parseFloat(((v - mean) / stdDev).toFixed(2)) : 0,
    isAnomaly: stdDev ? Math.abs((v - mean) / stdDev) > 2 : false
  })).filter(d => d.isAnomaly);
};

/**
 * Compute weekly progress comparing last 7 vs prior 7 days
 */
const computeWeeklyProgress = (logs, metric) => {
  const today = new Date();
  const oneWeekAgo = new Date(today); oneWeekAgo.setDate(today.getDate() - 7);
  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);

  const thisWeek = logs.filter(l => {
    const d = new Date(l.date);
    return d >= oneWeekAgo && d <= today;
  }).map(l => l[metric]).filter(v => v !== undefined && v !== null);

  const lastWeek = logs.filter(l => {
    const d = new Date(l.date);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  }).map(l => l[metric]).filter(v => v !== undefined && v !== null);

  if (!thisWeek.length || !lastWeek.length) return null;

  const thisAvg = thisWeek.reduce((s, v) => s + v, 0) / thisWeek.length;
  const lastAvg = lastWeek.reduce((s, v) => s + v, 0) / lastWeek.length;
  const delta = thisAvg - lastAvg;
  const pct = lastAvg !== 0 ? (delta / lastAvg) * 100 : 0;

  return {
    thisWeekAvg: parseFloat(thisAvg.toFixed(2)),
    lastWeekAvg: parseFloat(lastAvg.toFixed(2)),
    delta: parseFloat(delta.toFixed(2)),
    percentChange: parseFloat(pct.toFixed(1)),
    trend: delta > 0.1 ? 'up' : delta < -0.1 ? 'down' : 'stable'
  };
};

// ─────────────────────────────────────────────
// SECTION 3: HEALTH ANALYSIS ENGINE
// ─────────────────────────────────────────────

/**
 * Master health analysis function
 * Produces structured insights, warnings, and suggestions
 * based on profile + all logged data
 */
const analyzeHealthData = (profile, logs) => {
  const insights = [];
  const suggestions = [];
  const warnings = [];
  const achievements = [];

  if (!profile || !logs || logs.length === 0) {
    return { insights, suggestions, warnings, achievements, score: 0 };
  }

  const recentLogs = logs.slice(-14); // Last 14 days context
  const last7 = logs.slice(-7);

  // ── SLEEP ANALYSIS ──
  const sleepValues = last7.map(l => l.sleep).filter(v => v > 0);
  if (sleepValues.length >= 3) {
    const avgSleep = sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length;
    const sleepVariance = sleepValues.reduce((s, v) => s + Math.pow(v - avgSleep, 2), 0) / sleepValues.length;
    const sleepConsistency = Math.sqrt(sleepVariance); // StdDev as consistency metric

    if (avgSleep < 5) {
      warnings.push({
        type: 'sleep', severity: 'critical', icon: '🚨',
        title: 'Severe Sleep Deprivation',
        message: `Averaging only ${avgSleep.toFixed(1)}h/night. This is associated with 48% higher risk of heart disease and significant cognitive impairment.`,
        action: 'Prioritize sleep immediately. Consult a doctor if this is persistent.',
        metric: avgSleep, threshold: 7
      });
    } else if (avgSleep < 6.5) {
      warnings.push({
        type: 'sleep', severity: 'high', icon: '⚠️',
        title: 'Insufficient Sleep',
        message: `You're getting ${avgSleep.toFixed(1)}h/night vs the recommended 7-9h. Sleep debt accumulates — you can't fully "catch up" on weekends.`,
        action: 'Move bedtime 15 minutes earlier each day until you reach 7.5h.',
        metric: avgSleep, threshold: 7
      });
    } else if (avgSleep >= 7 && avgSleep <= 9) {
      insights.push({ type: 'sleep', icon: '✅', title: 'Excellent Sleep Duration', message: `Great job! You're averaging ${avgSleep.toFixed(1)}h of sleep this week.` });
      if (avgSleep >= 7.5 && avgSleep <= 8.5) achievements.push({ id: 'sleep-sweet-spot', label: '🌙 Sleep Champion', desc: 'Perfect sleep range for 3+ days' });
    }

    if (sleepConsistency > 1.5) {
      suggestions.push({
        type: 'sleep', icon: '🕐',
        title: 'Irregular Sleep Schedule',
        message: `High sleep variability (±${sleepConsistency.toFixed(1)}h) disrupts your circadian rhythm and reduces sleep quality even if total hours are adequate.`,
        action: 'Set a fixed wake time 7 days a week. Your circadian clock needs consistency.'
      });
    }
  }

  // ── HYDRATION ANALYSIS ──
  const waterValues = last7.map(l => l.water).filter(v => v > 0);
  if (waterValues.length >= 3 && profile.weight) {
    const recommended = calculateWaterNeeds(profile.weight);
    const avgWater = waterValues.reduce((s, v) => s + v, 0) / waterValues.length;
    const deficit = recommended - avgWater;

    if (deficit > 1.0) {
      warnings.push({
        type: 'hydration', severity: 'medium', icon: '💧',
        title: 'Chronic Dehydration Risk',
        message: `Drinking ${avgWater.toFixed(1)}L/day vs your target of ${recommended.toFixed(1)}L. Even 1-2% dehydration impairs concentration by 13%.`,
        action: `Drink one extra glass every 2 hours. That's ~${Math.ceil(deficit / 0.25)} extra glasses daily.`,
        metric: avgWater, threshold: recommended
      });
    } else if (deficit <= 0) {
      insights.push({ type: 'hydration', icon: '💧', title: 'Well Hydrated', message: `You're consistently meeting your ${recommended.toFixed(1)}L daily water goal.` });
    }
  }

  // ── EXERCISE ANALYSIS ──
  const exerciseSessions = last7.flatMap((log) => collectExerciseSessionsFromLog(log));
  const activeDays = last7.filter((log) => collectExerciseSessionsFromLog(log).length > 0).length;
  const totalMinutes = exerciseSessions.reduce((s, session) => s + (Number(session.duration) || 0), 0);
  const totalCaloriesBurned = exerciseSessions.reduce((s, session) => s + (Number(session.caloriesBurned) || 0), 0);
  const weeklyActiveDays = activeDays;

  if (exerciseSessions.length === 0) {
    warnings.push({
      type: 'exercise', severity: 'high', icon: '🏃',
      title: 'Zero Activity This Week',
      message: 'No exercise logged in 7 days. Physical inactivity is the 4th leading risk factor for global mortality.',
      action: 'Start with a 15-minute walk today. Any movement counts.',
      metric: 0, threshold: 150
    });
  } else if (totalMinutes < 90) {
    suggestions.push({
      type: 'exercise', icon: '🏋️',
      title: 'Below Activity Recommendations',
      message: `${totalMinutes} minutes across ${exerciseSessions.length} saved exercise session(s) vs WHO target of 150 minutes/week. You're at ${Math.round((totalMinutes / 150) * 100)}% of your goal.`,
      action: 'Add one 30-minute session or extend your current sessions by 5–10 minutes.',
      ctaLabel: 'Improve in app',
      ctaTarget: 'assistant',
      ctaPrompt: 'Help me improve my exercise routine using the health data in my app.'
    });
  } else if (totalMinutes >= 150) {
    insights.push({ type: 'exercise', icon: '💪', title: 'Meeting Activity Goals', message: `Excellent! ${totalMinutes} minutes across ${exerciseSessions.length} exercise session(s) this week — above WHO recommendations.` });
    if (totalMinutes >= 300) achievements.push({ id: 'exercise-elite', label: '🏆 Fitness Warrior', desc: '300+ minutes of exercise in a week' });
  }

  // ── BMI & WEIGHT ANALYSIS ──
  const bmi = calculateBMI(profile.weight, profile.height);
  const bmiCategory = getBMICategory(bmi);
  const idealRange = calculateIdealWeightRange(profile.height, profile.gender);

  if (bmiCategory.risk === 'very-high' || bmiCategory.risk === 'extreme') {
    warnings.push({
      type: 'bmi', severity: 'critical', icon: '📊',
      title: `BMI: ${bmi} — ${bmiCategory.label}`,
      message: `Your BMI indicates ${bmiCategory.label}. Ideal range for your height is ${idealRange.min}–${idealRange.max} kg.`,
      action: 'Use the in-app improvement plan below to increase calories, protein, and strength work safely.',
      ctaLabel: 'Improve in app',
      ctaTarget: 'assistant',
      ctaPrompt: 'Build me an in-app plan to improve severe thinness safely using my profile, meals, and exercise history.',
      metric: bmi, threshold: 25
    });
  } else if (bmiCategory.risk === 'high' || bmiCategory.risk === 'medium') {
    suggestions.push({
      type: 'bmi', icon: '⚖️',
      title: `BMI: ${bmi} — ${bmiCategory.label}`,
      message: `You're ${Math.abs(profile.weight - idealRange.ideal).toFixed(1)} kg from your ideal weight of ${idealRange.ideal} kg.`,
      action: bmi > 25 ? 'Aim for 0.5-1kg/week loss via caloric deficit + exercise.' : 'Focus on nutrient-dense caloric surplus of 300-500 kcal/day.',
      ctaLabel: 'Improve in app',
      ctaTarget: 'assistant',
      ctaPrompt: bmi > 25
        ? 'Create an in-app fat-loss plan based on my health data.'
        : 'Create an in-app weight-gain plan based on my health data.'
    });
  } else {
    insights.push({ type: 'bmi', icon: '✅', title: `Healthy BMI: ${bmi}`, message: `Within normal range. Keep maintaining your balanced lifestyle.` });
    achievements.push({ id: 'healthy-bmi', label: '⚖️ Healthy Weight', desc: 'BMI in normal range' });
  }

  // ── WEIGHT TREND ANALYSIS ──
  const weightTrend = logs.filter(l => l.weight).slice(-30);
  if (weightTrend.length >= 5) {
    const weights = weightTrend.map(l => l.weight);
    const regression = linearRegression(weights);
    const weeklyChange = regression.slope * 7;

    if (Math.abs(weeklyChange) > 1) {
      warnings.push({
        type: 'weight-change', severity: 'medium', icon: '📉',
        title: weeklyChange > 0 ? 'Rapid Weight Gain' : 'Rapid Weight Loss',
        message: `Trend shows ${Math.abs(weeklyChange).toFixed(2)} kg/week ${weeklyChange > 0 ? 'gain' : 'loss'}. Healthy rate is 0.25-0.75 kg/week.`,
        action: weeklyChange > 0 ? 'Review caloric intake and increase activity.' : 'Ensure adequate caloric intake to prevent muscle loss.',
        metric: weeklyChange, threshold: 0.5
      });
    }
  }

  // ── NUTRITION ANALYSIS ──
  const mealsLogs = last7.filter(l => l.meals && l.meals.length > 0);
  if (mealsLogs.length >= 3 && profile.weight) {
    const tdee = calculateTDEE(profile, weeklyActiveDays);
    const dailyCalories = mealsLogs.map(l => l.meals.reduce((s, m) => s + (m.calories || 0), 0));
    const avgCalories = dailyCalories.reduce((s, v) => s + v, 0) / dailyCalories.length;

    if (avgCalories < tdee * 0.65) {
      warnings.push({
        type: 'nutrition', severity: 'medium', icon: '🍎',
        title: 'Significant Caloric Deficit',
        message: `Averaging ${Math.round(avgCalories)} kcal vs estimated need of ${tdee} kcal. This may cause muscle catabolism and metabolic slowdown.`,
        action: 'Add one nutrient-dense meal or snack daily. Consider protein shakes if appetite is low.',
        metric: avgCalories, threshold: tdee
      });
    }

    // Protein check if tracked
    const proteinEntries = mealsLogs.flatMap(l => l.meals.map(m => m.protein || 0)).filter(v => v > 0);
    if (proteinEntries.length > 0) {
      const avgProtein = proteinEntries.reduce((s, v) => s + v, 0) / proteinEntries.length;
      const minProtein = profile.weight * 1.2;
      if (avgProtein < minProtein) {
        suggestions.push({
          type: 'nutrition', icon: '🥩',
          title: 'Low Protein Intake',
          message: `Averaging ${Math.round(avgProtein)}g protein/day vs minimum ${Math.round(minProtein)}g for your body weight.`,
          action: 'Add eggs, lentils, chicken, or Greek yogurt to each meal.'
        });
      }
    }
  }

  // ── OVERALL HEALTH SCORE ──
  let score = 100;
  warnings.forEach(w => {
    if (w.severity === 'critical') score -= 20;
    else if (w.severity === 'high') score -= 15;
    else if (w.severity === 'medium') score -= 8;
  });
  suggestions.forEach(() => { score -= 4; });
  insights.forEach(() => { score += 3; }); // Reward good habits

  score = Math.max(0, Math.min(100, score));

  return {
    insights: insights.map((item) => normalizeAlertItem(item, '✅')),
    suggestions: suggestions.map((item) => normalizeAlertItem(item, '💡')),
    warnings: warnings.map((item) => normalizeAlertItem(item, '⚠️')),
    achievements: [...new Map(achievements.map(a => [a.id, a])).values()].map((a) => ({
      id: toText(a.id),
      label: toText(a.label),
      desc: toText(a.desc)
    })),
    score: Math.round(score),
    bmi,
    bmiCategory,
    idealRange,
    tracker: {
      exerciseSessionCount: exerciseSessions.length,
      exerciseMinutes: totalMinutes,
      exerciseCaloriesBurned: totalCaloriesBurned,
      activeDays
    }
  };
};

// ─────────────────────────────────────────────
// SECTION 4: ROUTINE ANALYSIS ENGINE
// ─────────────────────────────────────────────

/**
 * Extract time references and activities from routine text
 * Supports formats: "8am", "8:30 AM", "08:30", "8 in the morning"
 */
const extractTimeActivities = (text) => {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const activities = [];

  const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/g;
  const activityKeywords = {
    sleep: ['sleep', 'bed', 'wake', 'nap', 'rest', 'snooze'],
    exercise: ['exercise', 'gym', 'run', 'walk', 'jog', 'workout', 'yoga', 'cycling', 'swim', 'sport'],
    meal: ['breakfast', 'lunch', 'dinner', 'eat', 'meal', 'food', 'snack', 'coffee', 'drink'],
    work: ['work', 'office', 'meeting', 'study', 'class', 'school', 'college'],
    leisure: ['tv', 'phone', 'social media', 'netflix', 'game', 'movie', 'scroll'],
    commute: ['commute', 'drive', 'travel', 'bus', 'metro', 'train'],
    selfCare: ['shower', 'bath', 'meditate', 'prayer', 'relax', 'stretch', 'read']
  };

  lines.forEach(line => {
    const lineLower = line.toLowerCase();
    let category = 'other';
    let priority = 3;

    for (const [cat, keywords] of Object.entries(activityKeywords)) {
      if (keywords.some(kw => lineLower.includes(kw))) {
        category = cat;
        priority = cat === 'exercise' ? 1 : cat === 'meal' ? 1 : cat === 'leisure' ? 4 : 2;
        break;
      }
    }

    const timeMatch = timePattern.exec(line);
    let hour = null;
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      const period = timeMatch[3]?.toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
    }
    timePattern.lastIndex = 0;

    activities.push({ line: line.trim(), category, hour, priority });
  });

  return activities;
};

/**
 * Analyze routine for health patterns and generate recommendations
 */
const analyzeRoutine = (routineText, profile) => {
  const issues = [];
  const suggestions = [];
  const positives = [];
  const activities = extractTimeActivities(routineText);
  const textLower = routineText.toLowerCase();

  // ── Late-night eating detection ──
  const lateNightFood = activities.filter(a =>
    a.category === 'meal' && a.hour !== null && (a.hour >= 21 || a.hour <= 4)
  );
  if (lateNightFood.length > 0) {
    issues.push({
      severity: 'medium', icon: '🌙',
      title: 'Late-Night Eating',
      detail: 'Eating after 9 PM disrupts circadian metabolism and impairs sleep quality. Insulin sensitivity is 25% lower at night.',
      fix: 'Try to finish your last meal at least 2-3 hours before bed.'
    });
  }

  // ── Sleep timing analysis ──
  const bedActivity = activities.find(a =>
    a.category === 'sleep' && (textLower.includes('bed') || textLower.includes('sleep'))
    && a.hour !== null && a.hour >= 22
  );
  const wakeActivity = activities.find(a =>
    a.category === 'sleep' && (textLower.includes('wake') || textLower.includes('morning'))
    && a.hour !== null && a.hour <= 10
  );

  const lateNight = activities.filter(a => a.hour !== null && a.hour >= 23).length > 0;
  const earlyMorning = textLower.includes('5am') || textLower.includes('6am') ||
    activities.some(a => a.hour !== null && a.hour >= 5 && a.hour <= 7);

  if (earlyMorning) {
    positives.push({ icon: '🌅', message: 'Early riser detected — early morning routines correlate with better mental health outcomes.' });
  }

  if (lateNight) {
    issues.push({
      severity: 'high', icon: '🌑',
      title: 'Late-Night Activity',
      detail: 'Activities past 11 PM suppresses melatonin production and delays sleep onset. Blue light from devices worsens this.',
      fix: 'Wind down at 10 PM with dim lighting, no screens, and a relaxing pre-sleep routine.'
    });
  }

  // ── Exercise timing ──
  const hasExercise = activities.some(a => a.category === 'exercise');
  const lateExercise = activities.filter(a =>
    a.category === 'exercise' && a.hour !== null && a.hour >= 21
  );

  if (!hasExercise && !textLower.includes('exercise') && !textLower.includes('workout') && !textLower.includes('walk')) {
    issues.push({
      severity: 'high', icon: '🏃',
      title: 'No Physical Activity',
      detail: 'Your routine contains no exercise. Sedentary behaviour increases mortality risk by up to 71% for high sitters.',
      fix: 'Insert a 20-30 minute walk or workout block into your schedule. Morning or lunch works best.'
    });
  } else if (hasExercise) {
    positives.push({ icon: '💪', message: 'Great! Physical activity is included in your routine.' });
    if (lateExercise.length > 0) {
      suggestions.push({
        icon: '🌙',
        title: 'Late Exercise May Affect Sleep',
        detail: 'Vigorous exercise raises cortisol and core temperature, which can delay sleep by 1-2 hours.',
        fix: 'Shift your workout to morning or at least 3 hours before bedtime.'
      });
    }
  }

  // ── Screen/leisure time ──
  const leisureActivities = activities.filter(a => a.category === 'leisure');
  const leisureHours = leisureActivities.length;
  if (leisureHours >= 3) {
    issues.push({
      severity: 'medium', icon: '📱',
      title: 'High Screen/Leisure Time',
      detail: `Detected ${leisureHours}+ blocks of passive leisure. Excessive screen time correlates with poor sleep, eye strain, and sedentary behaviour.`,
      fix: 'Use the 20-20-20 rule: every 20 minutes look at something 20 feet away for 20 seconds. Schedule screen-free hours.'
    });
  }

  // ── Meal regularity ──
  const mealsInRoutine = activities.filter(a => a.category === 'meal');
  if (mealsInRoutine.length === 0) {
    suggestions.push({
      icon: '🍽️',
      title: 'No Meal Schedule Detected',
      detail: 'Irregular meal timing disrupts insulin rhythm and increases hunger hormones.',
      fix: 'Schedule 3 meals at consistent times each day: breakfast 7-9am, lunch 12-1pm, dinner 6-8pm.'
    });
  } else if (mealsInRoutine.length === 1) {
    issues.push({
      severity: 'medium', icon: '🥗',
      title: 'Potential Meal Skipping',
      detail: 'Only one meal found in routine. Skipping meals leads to overeating, blood sugar crashes, and nutrient deficits.',
      fix: 'Add structured meal breaks. Even 3 smaller meals maintain better energy and metabolism.'
    });
  } else {
    positives.push({ icon: '🍽️', message: `${mealsInRoutine.length} meals scheduled — good eating structure!` });
  }

  // ── Stress & mental health ──
  const hasMindfulness = textLower.includes('meditat') || textLower.includes('prayer') ||
    textLower.includes('journal') || textLower.includes('breath');
  if (!hasMindfulness) {
    suggestions.push({
      icon: '🧘',
      title: 'No Mindfulness / Stress Relief',
      detail: 'No relaxation or mental health practices detected. Chronic stress without management increases cortisol, affecting sleep and immunity.',
      fix: 'Try 5-10 minutes of meditation or deep breathing. Apps like Insight Timer are free.'
    });
  } else {
    positives.push({ icon: '🧘', message: 'Mindfulness practice detected — great for stress and sleep quality.' });
  }

  // ── Generate optimized schedule suggestion ──
  const optimizedSchedule = generateOptimizedSchedule(activities, profile);

  // Routine score
  let routineScore = 70;
  issues.forEach(i => { routineScore -= i.severity === 'high' ? 15 : 8; });
  suggestions.forEach(() => { routineScore -= 4; });
  positives.forEach(() => { routineScore += 5; });
  routineScore = Math.max(0, Math.min(100, routineScore));

  return {
    activities: activities.map((item) => ({
      line: toText(item.line),
      category: toText(item.category),
      hour: Number.isFinite(Number(item.hour)) ? Number(item.hour) : null,
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 3
    })),
    issues: issues.map((item) => normalizeAlertItem(item, '⚠️')),
    suggestions: suggestions.map((item) => normalizeAlertItem(item, '💡')),
    positives: positives.map((item) => normalizeAlertItem(item, '✅')),
    optimizedSchedule,
    routineScore,
    summary: `Analyzed ${activities.length} activities. Found ${issues.length} issues, ${suggestions.length} improvements, ${positives.length} strengths.`
  };
};

/**
 * Generate a scientifically-optimized schedule template
 */
const generateOptimizedSchedule = (activities, profile) => {
  return [
    { time: '6:30 AM', activity: 'Wake up + 5 min stretching', category: 'selfCare', reason: 'Consistent wake time anchors circadian rhythm' },
    { time: '6:45 AM', activity: 'Drink 500ml water', category: 'hydration', reason: 'Rehydrate after 7-8h sleep' },
    { time: '7:00 AM', activity: 'Light exercise or walk (30 min)', category: 'exercise', reason: 'Morning cortisol peak enhances workout performance' },
    { time: '7:45 AM', activity: 'Protein-rich breakfast', category: 'meal', reason: 'Breakfast within 1hr of waking improves metabolic rate' },
    { time: '9:00 AM', activity: 'Deep focus work (2-3 hrs)', category: 'work', reason: 'Peak cognitive performance in morning hours' },
    { time: '12:00 PM', activity: 'Balanced lunch', category: 'meal', reason: 'Midday meal maintains blood sugar' },
    { time: '1:00 PM', activity: '10-min walk after lunch', category: 'exercise', reason: 'Post-meal walks reduce blood glucose spikes by 30%' },
    { time: '3:00 PM', activity: 'Snack + water break', category: 'meal', reason: 'Prevents afternoon energy crash' },
    { time: '6:00 PM', activity: 'Exercise / strength training', category: 'exercise', reason: 'Peak body temperature for strength performance' },
    { time: '7:00 PM', activity: 'Light dinner', category: 'meal', reason: 'Finish eating 3h before sleep for better recovery' },
    { time: '9:00 PM', activity: 'Wind-down: reading / journaling', category: 'selfCare', reason: 'Signals brain to prepare for sleep' },
    { time: '9:30 PM', activity: 'No screens — dim lights', category: 'selfCare', reason: 'Preserves melatonin production' },
    { time: '10:00 PM', activity: 'Sleep', category: 'sleep', reason: '7.5h sleep = 5 complete REM cycles' }
  ];
};

// ─────────────────────────────────────────────
// SECTION 5: INTELLIGENT CHATBOT ENGINE
// ─────────────────────────────────────────────

const INTENT_MAP = {
  bmi: { keywords: ['bmi', 'body mass index', 'am i fat', 'am i overweight', 'healthy weight', 'obese', 'underweight'], priority: 8 },
  sleep: { keywords: ['sleep', 'tired', 'fatigue', 'insomnia', 'cant sleep', 'can\'t sleep', 'rest', 'how much sleep', 'sleep tip', 'nap'], priority: 8 },
  water: { keywords: ['water', 'hydrat', 'drink', 'thirsty', 'dehydrat'], priority: 7 },
  exercise: { keywords: ['exercise', 'workout', 'fitness', 'gym', 'run', 'cardio', 'strength', 'lose weight', 'gain muscle', 'active', 'sedentary'], priority: 8 },
  diet: { keywords: ['eat', 'food', 'diet', 'nutrition', 'calor', 'protein', 'carb', 'fat', 'meal', 'breakfast', 'lunch', 'dinner', 'snack', 'veg', 'fruit'], priority: 8 },
  stress: { keywords: ['stress', 'anxious', 'anxiety', 'worried', 'mental health', 'mood', 'depressed', 'overwhelm', 'burn out', 'burnout'], priority: 9 },
  weight: { keywords: ['lose weight', 'gain weight', 'weight loss', 'weight gain', 'slim', 'bulk', 'cut', 'diet plan'], priority: 8 },
  heart: { keywords: ['heart', 'cardiovascular', 'blood pressure', 'cholesterol', 'stroke', 'cardiac'], priority: 9 },
  diabetes: { keywords: ['sugar', 'diabetes', 'glucose', 'insulin', 'blood sugar'], priority: 9 },
  motivation: { keywords: ['motivat', 'inspire', 'lazy', 'can\'t start', 'procrastinat', 'help me', 'where do i start', 'how do i begin'], priority: 6 },
  streak: { keywords: ['streak', 'consistent', 'habit', 'routine', 'daily'], priority: 5 },
  goal: { keywords: ['goal', 'target', 'aim', 'objective', 'plan', 'achieve'], priority: 6 },
  greeting: { keywords: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'how are you', 'sup'], priority: 3 },
  thanks: { keywords: ['thank', 'thanks', 'great', 'amazing', 'perfect', 'awesome'], priority: 2 }
};

/**
 * Detect intent from user message (priority-ranked multi-intent)
 */
const detectIntent = (message) => {
  const msgLower = message.toLowerCase();
  const matches = [];

  for (const [intent, config] of Object.entries(INTENT_MAP)) {
    const matchCount = config.keywords.filter(kw => msgLower.includes(kw)).length;
    if (matchCount > 0) {
      matches.push({ intent, score: matchCount * config.priority });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.length > 0 ? matches[0].intent : 'general';
};

/**
 * Generate contextual chatbot response based on intent + user data
 */
const chatbotResponse = (message, profile, recentLogs, goals) => {
  const intent = detectIntent(message);
  const hasSufficientData = recentLogs && recentLogs.length >= 3;
  const last7 = hasSufficientData ? recentLogs.slice(-7) : [];

  // Helper to get recent average
  const recentAvg = (metric) => {
    const vals = last7.map(l => l[metric]).filter(v => v > 0);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  const responses = {
    greeting: () => {
      const greetings = [
        `Hey there! 👋 I'm your AI Health Assistant. Ask me anything about your sleep, diet, exercise, hydration, or BMI. I can also analyze your health trends!`,
        `Hello! 😊 Ready to help you level up your health. What's on your mind — sleep, nutrition, fitness, or something else?`,
        `Hi! Great to see you checking in. ${profile ? `I see your profile is set up. Want a quick health summary based on your recent logs?` : `Start by setting up your profile to get personalized insights!`}`
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    },

    bmi: () => {
      if (!profile) return "I'd love to calculate your BMI! Please set up your profile with your height and weight first.";
      const bmi = calculateBMI(profile.weight, profile.height);
      const cat = getBMICategory(bmi);
      const ideal = calculateIdealWeightRange(profile.height, profile.gender);
      const diff = (profile.weight - ideal.ideal).toFixed(1);
      const direction = diff > 0 ? 'above' : 'below';

      return `📊 **Your BMI Analysis:**\n\n` +
        `• BMI: **${bmi}** — ${cat.label}\n` +
        `• Your current weight: **${profile.weight} kg**\n` +
        `• Ideal weight range: **${ideal.min}–${ideal.max} kg**\n` +
        `• You're **${Math.abs(diff)} kg ${direction}** your ideal range\n\n` +
        (bmi >= 18.5 && bmi < 25
          ? "✅ You're in a healthy BMI range! Focus on maintaining your current lifestyle."
          : bmi < 18.5
            ? "⚠️ Your BMI is below normal. Increase caloric intake with nutrient-dense foods like nuts, avocados, whole grains, and lean proteins."
            : "⚠️ Your BMI is above normal. A sustainable approach: 500 kcal daily deficit + 150+ mins exercise/week = ~0.5 kg/week loss.");
    },

    sleep: () => {
      const avgSleep = recentAvg('sleep');
      const baseAdvice = `**Evidence-based sleep optimization:**\n\n` +
        `• 📱 No screens 1 hour before bed (blue light suppresses melatonin by 50%)\n` +
        `• 🌡️ Keep bedroom at 65–68°F (18–20°C) — optimal for deep sleep\n` +
        `• ☕ Cut caffeine by 2 PM (half-life is 5-6 hours)\n` +
        `• 🕐 Fixed wake time 7 days/week (most impactful single change)\n` +
        `• 🌙 Wind-down routine 30–60 min before bed\n` +
        `• 🚫 Avoid alcohol — disrupts REM sleep even if it helps you fall asleep`;

      if (avgSleep !== null) {
        const emoji = avgSleep < 6 ? '🚨' : avgSleep < 7 ? '⚠️' : '✅';
        return `${emoji} Your recent average: **${avgSleep.toFixed(1)} hours/night**\n\n` +
          (avgSleep < 7
            ? `You're ${(7 - avgSleep).toFixed(1)}h short of the recommended 7-9h. Sleep debt compounds — each deficit night takes 2-3 nights to recover from.\n\n${baseAdvice}`
            : `Great sleep duration! Here's how to optimize sleep *quality*:\n\n${baseAdvice}`);
      }
      return baseAdvice;
    },

    water: () => {
      const target = profile ? calculateWaterNeeds(profile.weight) : 2.5;
      const avgWater = recentAvg('water');
      return `💧 **Hydration Guide:**\n\n` +
        (profile ? `• Your daily target: **${target.toFixed(1)}L** (${Math.round(target * 4)} glasses)\n` : '') +
        (avgWater ? `• Your recent average: **${avgWater.toFixed(1)}L/day**\n\n` : '\n') +
        `**Smart hydration habits:**\n` +
        `• Drink 500ml immediately after waking (replaces overnight loss)\n` +
        `• Set hourly phone reminders from 8am–8pm\n` +
        `• Drink a glass before every meal (also aids digestion)\n` +
        `• Urine should be pale yellow — dark = dehydrated, clear = overhydrated\n` +
        `• Add an extra 350ml per 30 mins of exercise\n` +
        `• 80% of hydration should come from water, 20% from food`;
    },

    exercise: () => {
      const activeDays = last7.filter(l => l.exercise?.duration > 0).length;
      const totalMins = last7.reduce((s, l) => s + (l.exercise?.duration || 0), 0);
      return `🏃 **Exercise Analysis:**\n\n` +
        (hasSufficientData ? `• Active days this week: **${activeDays}/7**\n• Total minutes: **${totalMins} min** (WHO target: 150+)\n\n` : '') +
        `**Optimal weekly structure (FITT principle):**\n` +
        `• 3–4x **Cardio** (150+ min/week): running, cycling, swimming\n` +
        `• 2–3x **Strength training**: builds metabolism-boosting muscle\n` +
        `• Daily **movement**: 7,500+ steps, stretch breaks every 60 min\n\n` +
        `**Beginner tip:** Start with a 20-min walk daily. Consistency beats intensity. ` +
        `After 2 weeks, add one 30-min session. Build gradually to avoid injury and burnout.`;
    },

    diet: () => {
      const macros = profile ? calculateMacroTargets(profile, goals?.[0]?.type || 'maintain', calculateTDEE(profile)) : null;
      return `🥗 **Nutrition Guide:**\n\n` +
        (macros ? `**Your daily targets:**\n• Calories: **${macros.calories} kcal**\n• Protein: **${macros.protein}g**\n• Carbs: **${macros.carbs}g**\n• Fat: **${macros.fat}g**\n• Fiber: **${macros.fiber}g**\n\n` : '') +
        `**Core nutrition principles:**\n` +
        `• Protein at every meal (satiety + muscle retention)\n` +
        `• Half your plate = vegetables (fiber, micronutrients)\n` +
        `• Minimize ultra-processed foods (>5 ingredients)\n` +
        `• Eat slowly — takes 20 min for fullness signals to reach brain\n` +
        `• Don't skip breakfast — sets metabolic tone for the day\n` +
        `• 80/20 rule: 80% whole foods, 20% flexibility`;
    },

    stress: () => {
      return `🧘 **Stress & Mental Health Guide:**\n\n` +
        `**Immediate techniques:**\n` +
        `• 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s (activates parasympathetic NS)\n` +
        `• Cold water on wrists/face: rapid cortisol reset\n` +
        `• 5-minute walk: lowers cortisol by 15%\n\n` +
        `**Daily habits:**\n` +
        `• 10 min morning meditation (Headspace, Calm, or Insight Timer — free tier)\n` +
        `• Journaling: 3 things you're grateful for\n` +
        `• Social connection: loneliness increases stress hormones as much as smoking\n` +
        `• Exercise: most powerful anti-anxiety intervention (30–60 min 3x/week)\n\n` +
        `⚠️ If stress is persistent or severe, please consult a mental health professional.`;
    },

    weight: () => {
      if (!profile) return "Set up your profile first so I can give you personalized weight advice!";
      const bmi = calculateBMI(profile.weight, profile.height);
      const tdee = calculateTDEE(profile);
      const loss500 = tdee - 500;
      const gain300 = tdee + 300;

      return `⚖️ **Weight Management Plan:**\n\n` +
        `• Current BMI: **${bmi}** (${getBMICategory(bmi).label})\n` +
        `• Estimated TDEE: **${tdee} kcal/day**\n\n` +
        `**For weight loss:** ${loss500} kcal/day = ~0.5 kg/week loss\n` +
        `**For weight gain:** ${gain300} kcal/day = ~0.3 kg/week gain\n` +
        `**For maintenance:** ${tdee} kcal/day\n\n` +
        `**Golden rules:**\n` +
        `• Never below 1200 kcal (women) / 1500 kcal (men)\n` +
        `• Protein ≥ ${Math.round(profile.weight * 1.6)}g/day to preserve muscle\n` +
        `• 0.5–1 kg/week loss = sustainable; faster = muscle loss\n` +
        `• Weigh yourself same time each day (morning, post-bathroom)`;
    },

    motivation: () => {
      const tips = [
        `🔥 **Getting Started:**\n\nThe hardest part is starting. Here's how:\n\n• **2-minute rule:** If it takes <2 min, do it now. Start a habit with just 2 minutes (walk to the door, do 1 pushup, drink one glass of water)\n• **Environment design:** Put your gym shoes by the bed, water on your desk, healthy food at eye level in the fridge\n• **Identity shift:** Don't say "I'm trying to exercise" — say "I'm someone who moves every day"\n• **Track streaks:** Missing twice in a row kills habits. Never miss twice.\n• **Celebrate small wins:** Every logged meal, every glass of water — it counts.`,
      ];
      return tips[0];
    },

    streak: () => {
      return `🔥 **Building Consistency:**\n\n` +
        `• Log your health data every day to build your streak\n` +
        `• Studies show habits become automatic at **66 days** on average (not 21!)\n` +
        `• **Never miss twice** — one miss is an accident, two is a new habit\n` +
        `• Your streak is tracked on the dashboard overview\n` +
        `• Streaks unlock achievements in the app 🏆`;
    },

    goal: () => {
      return `🎯 **Goal Setting Guide:**\n\n` +
        `Use the **Goals** section to set targets. Make goals SMART:\n\n` +
        `• **S**pecific: "Lose 5kg" not "lose weight"\n` +
        `• **M**easurable: Track via the health logs daily\n` +
        `• **A**chievable: 0.5–1 kg/week is realistic\n` +
        `• **R**elevant: Align with your health values\n` +
        `• **T**ime-bound: Set a deadline (e.g., 10 weeks)\n\n` +
        `Log consistently and the Insights engine will track your progress automatically.`;
    },

    heart: () => {
      return `❤️ **Heart Health:**\n\n` +
        `**Key lifestyle factors (evidence-based):**\n` +
        `• 150+ min/week aerobic exercise reduces heart disease risk by 35%\n` +
        `• DASH diet (vegetables, whole grains, lean protein) reduces blood pressure\n` +
        `• Sleep < 6h increases heart attack risk by 20%\n` +
        `• Chronic stress raises blood pressure via cortisol/adrenaline\n` +
        `• BMI < 25 significantly reduces cardiac load\n\n` +
        `⚠️ If you have chest pain, palpitations, or shortness of breath, see a doctor immediately.`;
    },

    diabetes: () => {
      return `🩺 **Blood Sugar & Metabolic Health:**\n\n` +
        `• Post-meal walks (10-15 min) reduce glucose spikes by 30%\n` +
        `• Choose low-glycemic foods: oats, lentils, sweet potato, berries\n` +
        `• Protein + fat with carbs slows glucose absorption\n` +
        `• Sleep deprivation causes insulin resistance (even 1-2 bad nights)\n` +
        `• Strength training improves insulin sensitivity by 20-40%\n` +
        `• Stay hydrated — dehydration concentrates blood glucose\n\n` +
        `⚠️ Consult a doctor for diabetes diagnosis or management.`;
    },

    thanks: () => {
      return `You're welcome! 😊 Keep up the great work logging your health data — the more you log, the more personalized insights I can give you. Every day counts! 💪`;
    },

    general: () => {
      return `I'm here to help with your health journey! You can ask me about:\n\n` +
        `• 📊 BMI & healthy weight\n` +
        `• 😴 Sleep optimization\n` +
        `• 💧 Hydration needs\n` +
        `• 🏃 Exercise & fitness\n` +
        `• 🥗 Nutrition & diet\n` +
        `• 🧘 Stress management\n` +
        `• ⚖️ Weight management\n` +
        `• 🎯 Goal setting\n\n` +
        `What would you like to know?`;
    }
  };

  const responseFn = responses[intent] || responses.general;
  return {
    message: responseFn(),
    intent,
    timestamp: new Date().toISOString()
  };
};


// ─────────────────────────────────────────────
// SECTION 5.5: EXERCISE ANALYSIS
// ─────────────────────────────────────────────

const estimateExerciseCalories = (profile = {}, exercise = {}) => {
  const weight = Number(profile.weight) > 0 ? Number(profile.weight) : 70;
  const duration = Math.max(0, Number(exercise.duration) || 0);
  const intensity = String(exercise.intensity || 'moderate').toLowerCase();
  const rawType = String(exercise.name || exercise.type || '').trim().toLowerCase();

  const metTable = {
    walking: 3.5,
    run: 7.5,
    running: 7.5,
    cycling: 6.8,
    bike: 6.8,
    swimming: 8.0,
    gym: 5.5,
    'weight training': 5.5,
    weights: 5.5,
    yoga: 2.8,
    hiit: 9.5,
    sports: 7.0,
    dancing: 5.5,
    hiking: 6.0,
    other: 4.5
  };

  let met = metTable[rawType] || metTable.other;

  const intensityMultiplier = {
    light: 0.85,
    moderate: 1,
    intense: 1.2
  };

  met *= intensityMultiplier[intensity] || 1;
  return Math.max(0, Math.round(met * weight * (duration / 60)));
};

const analyzeExerciseSession = (profile = {}, exercise = {}, context = {}) => {
  const caloriesBurned = estimateExerciseCalories(profile, exercise);
  const weight = Number(profile.weight) > 0 ? Number(profile.weight) : 70;
  const duration = Math.max(0, Number(exercise.duration) || 0);
  const intensity = String(exercise.intensity || 'moderate').toLowerCase();
  const exerciseLabel = String(exercise.name || exercise.type || 'exercise').trim() || 'exercise';

  const insights = [];
  const suggestions = [];
  const warnings = [];

  if (!exerciseLabel || exerciseLabel === 'exercise') {
    warnings.push({
      type: 'exercise',
      severity: 'low',
      icon: '🏷️',
      title: 'Exercise Type Missing',
      message: 'Add a specific exercise name so analysis becomes more accurate.',
      action: 'Use a clear label like Running, Walking, Gym, or a custom exercise name.'
    });
  }

  if (duration === 0) {
    warnings.push({
      type: 'exercise',
      severity: 'medium',
      icon: '⏱️',
      title: 'Duration Missing',
      message: 'Exercise was saved without a duration, so calorie estimation is limited.',
      action: 'Enter the session length in minutes before saving.'
    });
  } else if (duration < 10) {
    suggestions.push({
      type: 'exercise',
      icon: '📈',
      title: 'Short Session',
      message: 'Very short sessions improve momentum, but longer sessions give more reliable training stimulus.',
      action: 'Aim for at least 20–30 minutes when possible.'
    });
  }

  if (intensity === 'intense' && weight < 40) {
    warnings.push({
      type: 'exercise',
      severity: 'high',
      icon: '⚠️',
      title: 'High Intensity for Low Body Weight',
      message: 'High-intensity sessions can be demanding when body weight is very low.',
      action: 'Keep recovery, hydration, and food intake high.'
    });
  }

  if (profile.goal && String(profile.goal).toLowerCase().includes('muscle')) {
    insights.push({
      type: 'exercise',
      icon: '💪',
      title: 'Muscle-Gain Support',
      message: 'Strength-focused exercise supports your muscle-gain goal best when paired with enough protein and calories.'
    });
  }

  if (caloriesBurned > 0) {
    insights.push({
      type: 'exercise',
      icon: '🔥',
      title: 'Calorie Burn Estimated',
      message: `This session is estimated to burn about ${caloriesBurned} kcal based on your profile and exercise details.`
    });
  }

  if (context?.hasHistoricalExercise) {
    suggestions.push({
      type: 'exercise',
      icon: '🧠',
      title: 'Trend Tracking Enabled',
      message: 'Your previous exercise logs will help the AI compare consistency and progression over time.',
      action: 'Keep saving exercise entries regularly for better recommendations.'
    });
  }

  return {
    type: 'exercise_analysis',
    exercise: exerciseLabel,
    duration,
    intensity,
    caloriesBurned,
    insights,
    suggestions,
    warnings,
    summary: duration > 0
      ? `Analyzed ${exerciseLabel} for ${duration} minutes at ${intensity} intensity.`
      : `Analyzed ${exerciseLabel} with limited duration data.`
  };
};

// ─────────────────────────────────────────────
// SECTION 6: STREAK & ACHIEVEMENT SYSTEM
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────

/**
 * Update streak based on today's log submission
 */
const updateStreak = (streakData, lastLogDate) => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const lastDate = lastLogDate ? new Date(lastLogDate).toDateString() : null;

  let { currentStreak, longestStreak, totalLoggedDays } = streakData;

  if (lastDate === today) {
    // Already logged today — no change
    return streakData;
  }

  if (lastDate === yesterday || lastDate === null) {
    // Consecutive day or first log
    currentStreak = (lastDate === null) ? 1 : currentStreak + 1;
    totalLoggedDays = (totalLoggedDays || 0) + 1;
    longestStreak = Math.max(longestStreak || 0, currentStreak);
  } else {
    // Streak broken
    currentStreak = 1;
    totalLoggedDays = (totalLoggedDays || 0) + 1;
  }

  return {
    currentStreak,
    longestStreak,
    totalLoggedDays,
    lastLogDate: new Date().toISOString()
  };
};

/**
 * Compute achievements based on user data
 */
const computeAchievements = (streaks, logs, profile) => {
  const earned = [];

  if (streaks.currentStreak >= 3) earned.push({ id: 'streak-3', label: '🔥 3-Day Streak', desc: 'Logged for 3 days in a row' });
  if (streaks.currentStreak >= 7) earned.push({ id: 'streak-7', label: '⚡ Week Warrior', desc: '7-day logging streak!' });
  if (streaks.currentStreak >= 30) earned.push({ id: 'streak-30', label: '👑 Habit Master', desc: '30-day streak — incredible!' });
  if (streaks.totalLoggedDays >= 10) earned.push({ id: 'total-10', label: '📝 Dedicated Logger', desc: '10 total log days' });
  if (streaks.totalLoggedDays >= 50) earned.push({ id: 'total-50', label: '🌟 Health Veteran', desc: '50 total log days' });

  if (logs.length >= 1) earned.push({ id: 'first-log', label: '🚀 First Step', desc: 'Logged your first health entry' });

  if (profile) earned.push({ id: 'profile-complete', label: '👤 Profile Set', desc: 'Created your health profile' });

  return earned;
};

module.exports = {
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
  analyzeHealthData,
  analyzeRoutine,
  chatbotResponse,
  estimateExerciseCalories,
  analyzeExerciseSession,
  updateStreak,
  computeAchievements
};
