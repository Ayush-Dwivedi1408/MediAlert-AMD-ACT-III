# 🏥 MediAlert — AI-Powered Emergency Decision Support Platform

> **Portfolio project demonstrating end-to-end AI + backend + frontend engineering for real-world healthcare problems.**

![Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Claude%20AI-2563eb)
![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-16a34a)
![Lang](https://img.shields.io/badge/Language-English%20%7C%20Hindi-f59e0b)

---

## What this project is — and what it honestly isn't

MediAlert is a **portfolio project demonstrating a full-stack AI healthcare engineering pipeline**. It is not a clinically validated medical device and must never be used as one.

The disease prediction uses Claude (claude-sonnet-4-6) via the Anthropic API. NEWS2 scoring is implemented from the published Royal College of Physicians specification. Emergency severity logic is rule-based, documented, and auditable. All predictions include explicit disclaimers.

This is stated openly because being able to articulate what a system *cannot* do is part of the engineering skill being demonstrated.

---

## Features

### 🚨 Feature 1 — Emergency Severity Detection
Not just disease prediction. The system answers: **"How dangerous is this patient right now?"**

- Input: SpO2 = 85%, Chest Pain, Fever
- Output: 🚨 CRITICAL · Risk Score: 92/100 · Call Ambulance — 102/108
- Red-flag symptom detection (chest pain, altered consciousness, slurred speech)
- Vital threshold crossing (SpO2 < 90% → CRITICAL regardless of other inputs)
- NEWS2 score escalation (≥7 → P1 Critical)

### 🔍 Feature 2 — Explainable AI (SHAP-style)
Every prediction shows *why* the AI predicted it:
```
Pneumonia: 82%
  ✓ Fever contributed
  ✓ Cough contributed  
  ✓ Low SpO2 contributed
  ✓ Chest Pain contributed
  💡 "These four symptoms together are the classic presentation of pneumonia..."
```

### 🪪 Feature 3 — Smart Health Card + QR Code
- QR code encodes: blood group, allergies, medications, emergency contact
- In an accident: hospital scans QR → gets critical info in seconds
- Print-ready card layout
- Works without internet (data embedded in QR)

### 🆘 Feature 4 — SOS Mode
One button:
1. Gets GPS location
2. Composes emergency message with health profile
3. Opens WhatsApp to emergency contact pre-filled
4. Sends: name, blood group, allergies, medications, location link

### 📄 Feature 5 — Professional PDF Medical Report
Multi-page PDF includes:
- Emergency severity banner
- Patient details + vitals
- Symptom list
- AI disease predictions with probabilities
- First aid instructions per disease
- When to go to hospital guidance
- Disclaimer footer

### 🔔 Feature 6 — Real-Time Alerts
Triggered automatically when vitals cross thresholds:
- SpO2 < 90% → 🚨 Critical Alert
- SpO2 90-94% → ⚠️ Warning Alert
- Pulse > 130 or < 40 → 🚨 Critical Alert
- Temperature ≥ 104°F → 🚨 Critical Alert
- Stored in DB · Unread count in nav · Markable as resolved

### 📊 Feature 7 — Analytics Dashboard
- Monthly visit trend (line chart)
- Triage distribution (pie chart)
- Risk score distribution (bar chart)
- Top 10 most predicted diseases
- Emergency case summary

### 💬 Feature 8 — Health Literacy Assistant
Every result page includes plain-language explanation:
- "Your oxygen level is low. This means your body is not getting enough oxygen."
- "Watch for: difficulty breathing, bluish lips, confusion"
- Full Hindi translation available

### 🧠 Feature 9 — PHQ-9 / GAD-7 Mental Health Screening
Real validated clinical tools:
- PHQ-9: Depression screening (9 questions, 0-27 score)
- GAD-7: Anxiety screening (7 questions, 0-21 score)
- Crisis detection (PHQ-9 Q9 self-harm flag)
- India-specific helpline resources (iCall, Vandrevala Foundation)
- Hindi language support
- History tracking across screenings

### 📉 Feature 10 — Patient Deterioration Warning
- Tracks risk score across all visits
- Linear regression to detect trend
- Predicts next visit risk score
- Alert: "⚠️ Predicted risk in next visit: 82/100. Urgent review recommended."

### 📅 Feature 11 — Follow-Up Visit Tracker
- Log Day 1, Day 3, Day 7 check-ins
- System identifies: symptoms resolved, symptoms worsened, new symptoms
- Status: IMPROVING / STABLE / WORSENING / FLUCTUATING
- Creates healthcare continuity beyond single visit

### 📱 Feature 12 — Offline-First PWA
- Installable on mobile home screen
- Works without internet (cached assets)
- Offline banner shown when disconnected
- API responses cached via Service Worker
- Sync on reconnection

### 🔐 Feature 13 — Unique Patient ID + Auth
- Auto-generated IDs: PAT-XXXX-XXXX
- API key authentication on all endpoints
- Patient lookup by ID
- All visits linked to patient

### 🤖 Feature 14 — AI Health Record Summarizer
- "Click Generate" on dashboard → Claude summarizes entire visit history
- "Patient had 3 respiratory episodes. Risk score trending upward from 35 to 68."
- Pattern recognition across visits

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend API | Python 3.11, FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (dev) → PostgreSQL-ready |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Clinical Scoring | NEWS2 (Royal College of Physicians) |
| Frontend | React 18, Vite, React Router, Recharts |
| State | Zustand |
| PDF | jsPDF + jsPDF-autoTable |
| QR Code | qrcode (npm) |
| PWA | vite-plugin-pwa, Workbox |
| Auth | API key (X-API-Key header) |
| Deploy | Docker, docker-compose |
| i18n | English + Hindi (full UI translation) |

---

## Project Structure

```
medialert/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                    # App entrypoint, CORS, routing
│       ├── auth.py                    # API key authentication
│       ├── models/
│       │   ├── patient.py             # Patient ORM
│       │   ├── visit.py               # Visit ORM (vitals, symptoms, results)
│       │   ├── alert.py               # Real-time alerts ORM
│       │   ├── followup.py            # Follow-up visit ORM
│       │   └── mental_health.py       # PHQ-9/GAD-7 screenings ORM
│       ├── schemas/
│       │   ├── patient.py             # Pydantic request/response schemas
│       │   └── visit.py               # Visit schemas
│       ├── services/
│       │   ├── news2.py               # NEWS2 clinical scoring (RCP)
│       │   ├── severity.py            # Emergency severity detection engine
│       │   ├── alerts.py              # Real-time alert generation
│       │   ├── prediction.py          # Claude AI disease prediction + explainability
│       │   ├── deterioration.py       # Patient deterioration early warning
│       │   ├── mental_health.py       # PHQ-9 / GAD-7 scoring
│       │   └── health_card.py         # Smart health card + QR generation
│       ├── routers/
│       │   ├── patients.py            # Patient CRUD, summary, health card, AI summary
│       │   ├── visits.py              # Visit creation + full prediction pipeline
│       │   ├── symptoms.py            # Symptom list + mental health endpoints
│       │   ├── alerts.py              # Alert management endpoints
│       │   └── predict.py             # Analytics + follow-up endpoints
│       └── db/
│           ├── base.py                # SQLAlchemy declarative base
│           └── session.py             # DB session + get_db dependency
├── frontend/
│   ├── index.html
│   ├── vite.config.js                 # Vite + PWA config
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Router, layout, nav, auth guard
│       ├── api/client.js              # Single source of truth for all API calls
│       ├── store/index.js             # Zustand global state
│       ├── i18n/index.js              # English + Hindi translations
│       ├── utils/
│       │   ├── pdfReport.js           # PDF medical report generator
│       │   └── sos.js                 # SOS WhatsApp emergency sender
│       └── pages/
│           ├── LoginPage.jsx          # Registration + returning patient login
│           ├── DashboardPage.jsx      # Stats, alerts, risk trend, SOS, AI summary
│           ├── SymptomsPage.jsx       # Vitals + 132 symptoms by category
│           ├── ResultsPage.jsx        # Severity banner, SHAP, first aid, PDF
│           ├── HistoryPage.jsx        # All visits + follow-up tracker
│           ├── AnalyticsPage.jsx      # Charts, trends, disease distribution
│           ├── MentalHealthPage.jsx   # PHQ-9 / GAD-7 with Hindi support
│           └── HealthCardPage.jsx     # QR card + SOS button + print
```

---

## Quickstart

### Docker (recommended)
```bash
git clone https://github.com/YOUR_USERNAME/medialert
cd medialert
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker compose up --build
```
- Frontend → http://localhost:3000
- Backend API → http://localhost:8000/docs

### Local Development

**Terminal 1 — Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:5173

---

## NEWS2 Implementation

NEWS2 (National Early Warning Score 2) is published by the Royal College of Physicians (UK). Implemented exactly per specification:

- All 6 core parameters scored 0-3 each
- Red score rule: single parameter ≥3 escalates minimum risk level
- Thresholds: 0-4 LOW, 5-6 MEDIUM, ≥7 HIGH

**Documented simplifications (not hidden):**
- No +2 oxygen therapy modifier (O2 status not in data model)
- No SpO2 Scale 2 for COPD (chronic respiratory diagnosis not tracked)

---

## What's Honestly Not Built

| Feature | Decision |
|---|---|
| Real ML model | Using Claude API for prediction — synthetic data model would not be honest |
| JWT auth | API key auth used — JWT is the production path, documented |
| Real clinical validation | This is a portfolio project, not a medical device |
| Push notifications | PWA notification setup — future work |
| PostgreSQL | One env var change from SQLite |

---

## Disclaimer

This platform is built for portfolio demonstration purposes. It is **not a medical device**, has not been clinically validated, and must not be used for real medical decisions. Always consult a qualified doctor.

Emergency numbers (India): 102 (Ambulance) · 108 (Emergency) · 112 (National Emergency)
Mental health (India): iCall 9152987821 · Vandrevala Foundation 1860-2662-345
