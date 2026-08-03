/**
 * Health Assistant — Express Backend
 * Now loads .env for ANTHROPIC_API_KEY
 */
const path = require('path');
// Load .env (optional)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDB } = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
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
    time: new Date().toISOString(),
    aiReady: !!process.env.ANTHROPIC_API_KEY
  });
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🏥 Health Assistant API → http://localhost:${PORT}`);
  console.log('🤖 Vita AI: Requires GROQ_API_KEY from frontend request headers\n');
});

module.exports = app;
