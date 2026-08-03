/**
 * Database utility - simple JSON file read/write
 * Acts as a lightweight local "database"
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

// Ensure data directory and file exist
const initDB = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      profile: null,
      healthLogs: [],
      goals: [],
      routineAnalyses: [],
      exerciseAnalyses: [],
      chatHistory: [],
      streaks: { currentStreak: 0, lastLogDate: null, longestStreak: 0, totalLoggedDays: 0 },
      notifications: [],
      achievements: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
};

const readDB = () => {
  initDB();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('DB read error:', e);
    return {};
  }
};

const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('DB write error:', e);
    return false;
  }
};

module.exports = { readDB, writeDB, initDB };
