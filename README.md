# NF App(F)(D9) - AI-Powered Health Assistant

**NF App(F)(D9)** is an AI-powered health and routine dashboard built to help users track daily behavior, analyze routines, save exercise sessions, estimate calories burned, and get personalized AI guidance from one unified app.

Most health apps only store data. This app **interprets** it.

---

## What this app does

This application brings together multiple health tracking features and powers them with AI:

- **Routine Analyzer**: Upload or paste a daily routine and get AI analysis with scoring, issues, suggestions, and an action plan.
- **Health Tracker**: Save health entries such as sleep, meals, water, mood, weight, and exercise history.
- **Exercise Saver**: Log exercise (type, duration, intensity, etc.) and calculate estimated calories burned.
- **Health Insights**: Get AI-powered suggestions based on your logs, BMI, weight goal, and recurring patterns.
- **AI Chat**: Ask questions and receive answers that are informed by your saved routine, logs, profile, and analysis history.
- **Daily Brief**: Get a short, personalized health check-in based on the time of day and your recent data.

---

## Project Structure (Restructured)

The project has been simplified into a single root directory for both frontend (React) and backend (Express) files.

```text
NF App(F)(D9)
├─ package.json        (Combined dependencies for client & server)
├─ server.js           (Express server entry point)
├─ routes/             (Backend API routes: ai, routine, health, etc.)
├─ utils/              (Backend utilities: db.js, aiEngine.js)
├─ data/               (Local JSON database storage)
├─ public/             (React public assets)
├─ src/                (React source code and components)
└─ README.md
```

### Summary of Moved Files and Important Paths
- **`frontend/src/` → `src/`**: All React components, pages, and frontend utilities (e.g., `src/utils/api.js`).
- **`frontend/public/` → `public/`**: All static assets for the React app.
- **`backend/server.js` → `server.js`**: The main Express backend server file.
- **`backend/routes/` → `routes/`**: API endpoints including AI and routines.
- **`backend/utils/` → `utils/`**: Helper files like `db.js` and `aiEngine.js`.
- **`backend/data/` → `data/`**: JSON files used for local storage.
- **`package.json`**: The `frontend` and `backend` dependencies have been merged into the root `package.json`.

---

## How to run locally

1. **Install all dependencies**  
   From the root folder, simply run:
   ```bash
   npm install
   ```

2. **Start the app**  
   Start both the frontend and backend servers concurrently:
   ```bash
   npm start
   ```

3. **Open in browser**  
   - Frontend Dashboard: [http://localhost:3000](http://localhost:3000)
   - Backend API: `http://localhost:5000`

---

## Setting up AI (Groq API Key)

This application uses **Groq** to provide lightning-fast, free AI capabilities (via Llama 3). We have updated the app so you do **not** need to manage a backend `.env` file for API keys. Instead, the key is provided directly in the frontend UI and stored securely in your browser.

### How to get a free Groq key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign in or create a free account (no credit card required).
3. Navigate to **API Keys** in the sidebar.
4. Click **Create API Key** and copy the generated key (it starts with `gsk_...`).

### How to add it to the app
1. Open the app in your browser ([http://localhost:3000](http://localhost:3000)).
2. Navigate to the **AI Assistant** tab.
3. In the top section, you will see an input field labeled **"Enter Groq API Key"**.
4. Paste your key into this field. It will automatically save to your browser's local storage and unlock all AI features (Chat, Daily Brief, Routine Analysis).

---

## Troubleshooting

- **Proxy Errors (Frontend)**: If the React app shows a proxy error, ensure the backend is running properly on port 5000. Check the terminal for any backend crash logs.
- **AI Features Not Working**: If the AI responds with an error, double-check that you entered your Groq API key correctly in the AI Assistant tab.
- **Port Conflicts**: If port 3000 or 5000 is already in use, you can update the ports in `package.json` (for React) or `server.js` (for Express).

---

Enjoy your AI-powered Health Assistant!
