/**
 * Health Assistant — Express Backend
 * Works locally and on Vercel
 */
const path = require('path');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Open CORS for portfolio / demo hosting
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

initDB();

app.use('/api/profile', require('./routes/profile'));
app.use('/api/health', require('./routes/health'));
app.use('/api/routine', require('./routes/routine'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/insights', require('./routes/insights'));

app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Serve React build in production / on Vercel
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(buildPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Only listen locally — Vercel uses the exported app
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏥 Health Assistant API → http://localhost:${PORT}`);
    console.log('🤖 Vita AI: Enter Groq key in the frontend\n');
  });
}

module.exports = app;
