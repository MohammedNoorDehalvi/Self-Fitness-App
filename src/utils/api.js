/**
 * API utility — all backend communication
 * Uses fetch with the proxy configured in package.json
 */

const BASE = '/api';

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const getHeaders = (isJson = false) => {
  const headers = {};
  if (isJson) headers['Content-Type'] = 'application/json';
  const groqKey = localStorage.getItem('groq_api_key');
  if (groqKey) headers['X-Groq-Key'] = groqKey;
  return headers;
};

const api = {
  // ── Profile ──
  getProfile: () => fetch(`${BASE}/profile`, { headers: getHeaders() }).then(handleResponse),

  saveProfile: (profile) => fetch(`${BASE}/profile`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(profile)
  }).then(handleResponse),

  // ── Health Logs ──
  getLogs: (days) => fetch(`${BASE}/health${days ? `?days=${days}` : ''}`, { headers: getHeaders() }).then(handleResponse),

  getTodayLog: () => fetch(`${BASE}/health/today`, { headers: getHeaders() }).then(handleResponse),

  getSummary: () => fetch(`${BASE}/health/summary`, { headers: getHeaders() }).then(handleResponse),

  getStreaks: () => fetch(`${BASE}/health/streaks`, { headers: getHeaders() }).then(handleResponse),

  saveLog: (log) => fetch(`${BASE}/health`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(log)
  }).then(handleResponse),

  saveExercise: (exercise) => fetch(`${BASE}/health/exercise`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(exercise)
  }).then(handleResponse),

  deleteLog: (id) => fetch(`${BASE}/health/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),

  // ── AI & Chatbot ──
  sendChat: (message, location) => fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ message, location })
  }).then(handleResponse),

  getDailyBrief: (location) => fetch(`${BASE}/ai/daily-brief`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ location })
  }).then(handleResponse),

  getChatHistory: () => fetch(`${BASE}/ai/history`, { headers: getHeaders() }).then(handleResponse),

  clearChatHistory: () => fetch(`${BASE}/ai/history`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),

  getSuggestions: () => fetch(`${BASE}/ai/suggestions`, { headers: getHeaders() }).then(handleResponse),

  getDashboardAI: () => fetch(`${BASE}/ai/dashboard`, { headers: getHeaders() }).then(handleResponse),

  getAiStatus: () => fetch(`${BASE}/ai/status`, { headers: getHeaders() }).then(handleResponse),

  // ── Routine Analysis ──
  analyzeRoutine: (routineText) => fetch(`${BASE}/routine/analyze`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({ routineText })
  }).then(handleResponse),

  getRoutineHistory: () => fetch(`${BASE}/routine/history`, { headers: getHeaders() }).then(handleResponse),

  // ── Goals ──
  getGoals: () => fetch(`${BASE}/goals`, { headers: getHeaders() }).then(handleResponse),

  getGoalsProgress: () => fetch(`${BASE}/goals/progress`, { headers: getHeaders() }).then(handleResponse),

  saveGoal: (goal) => fetch(`${BASE}/goals`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(goal)
  }).then(handleResponse),

  deleteGoal: (id) => fetch(`${BASE}/goals/${id}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse),

  // ── Insights ──
  getInsights: () => fetch(`${BASE}/insights`, { headers: getHeaders() }).then(handleResponse),

  getBiometrics: () => fetch(`${BASE}/insights/biometrics`, { headers: getHeaders() }).then(handleResponse),
};

export default api;
