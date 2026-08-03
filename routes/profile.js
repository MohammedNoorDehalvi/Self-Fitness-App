const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../utils/db');

// GET profile
router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.profile || null);
});

// POST/PUT profile (upsert)
router.post('/', (req, res) => {
  const { name, age, height, weight, gender, activityLevel } = req.body;

  if (!age || !height || !weight || !gender) {
    return res.status(400).json({ error: 'age, height, weight, and gender are required' });
  }
  if (age < 1 || age > 120) return res.status(400).json({ error: 'Invalid age' });
  if (height < 50 || height > 300) return res.status(400).json({ error: 'Invalid height (cm)' });
  if (weight < 10 || weight > 500) return res.status(400).json({ error: 'Invalid weight (kg)' });

  const db = readDB();
  db.profile = {
    name: name || 'User',
    age: parseInt(age),
    height: parseFloat(height),
    weight: parseFloat(weight),
    gender: gender.toLowerCase(),
    activityLevel: activityLevel || 'moderate',
    updatedAt: new Date().toISOString(),
    createdAt: db.profile?.createdAt || new Date().toISOString()
  };
  writeDB(db);
  res.json({ success: true, profile: db.profile });
});

module.exports = router;
