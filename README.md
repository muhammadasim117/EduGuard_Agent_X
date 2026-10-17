# EduGuard Agent — AI Security for Educational Data Protection

**Developed by Team SentrX**

EduGuard Agent is an AI cybersecurity agent designed to protect sensitive educational and student data in school districts. It proactively flags risky access attempts, synthesizes raw audit facts, explains why the activity matters in plain language, and provides human-in-the-loop decision controls for school administrators.

---

## 1. System Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide icons, Canvas procedural cloudy digital atmosphere.
- **Backend**: FastAPI (Python 3.10+), Pydantic v2, Uvicorn, Passlib / PBKDF2-HMAC password encryption, HTTPX.
- **AI Agent Providers**:
  - **AMD Direct Mode** (`DeepSeek-V4.1-Flash` on AMD ROCm/Radeon endpoint)
  - **Evolus Agent Mode** (`EVOLUS_APP_ID:EVOLUS_AGENT_ID`)
  - **Google Gemini Mode** (`gemini-2.5-flash` via AI Studio runtime)
  - **Auto Fallback** (attempts primary agent; smoothly falls back to AMD or Gemini if upstream provider times out)
- **Data Persistence**:
  - `backend/data/users.json` (30 district staff accounts)
  - `backend/data/permissions.json` (class allowances, admin privilege levels, authorized districts)
  - `backend/data/students.json` (120 student records across Grades 4–8)
  - `backend/data/access_logs.json` (288 time-series access events)
  - `backend/data/incidents.json` (5 seeded security scenarios: I001–I005)
  - `backend/data/accounts.json` (persistent administrator user registry with PBKDF2 password hashing)

---

## 2. API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/scan?min_severity=low` | Scans all accounts against deterministic school district security rules without invoking AI models. Supports `min_severity=low\|medium\|high\|critical`. |
| `GET` | `/incidents` | Retrieves seeded security incidents. Supports `user_id` and `expected_risk` filters. |
| `GET` | `/incidents/{id}` | Retrieves details for a specific incident scenario. |
| `GET` | `/incidents/{id}/analysis` | Retrieves stored AI analysis and decision record. Returns `404` if not yet analyzed. |
| `POST` | `/incidents/{id}/analyze` | Submits raw facts to the configured AI agent and stores the analysis. |
| `POST` | `/incidents/{id}/decision` | Submits administrator review: `{"decision": "approve"\|"reject"\|"escalate", "decided_by": "...", "note": "..."}`. |
| `POST` | `/auth/signup` | Registers a new administrator account with PBKDF2 encryption. |
| `POST` | `/auth/login` | Authenticates administrator credentials and issues a secure session token. |
| `POST` | `/auth/logout` | Terminates active session. |
| `GET` | `/auth/me` | Returns authenticated user profile. |
| `GET` | `/health` | Reports data counts, integrity checks, and AI provider status. |
| `POST` | `/reload` | Re-reads JSON files from disk without restarting the server. |

---

## 3. Quick Start & Startup Instructions

### Backend Startup

```bash
# 1. Install dependencies
pip install -r backend/requirements.txt passlib bcrypt python-jose pytest

# 2. Start the FastAPI server (Port 8080)
python3 -m uvicorn app.main:app --app-dir ./backend --port 8080 --host 0.0.0.0 --reload
```

### Frontend Startup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Start the development server (Port 3000)
npm run dev
```

The Vite dev server automatically proxies API calls to the backend on `http://127.0.0.1:8080`.

---

## 4. Default Demonstration Credentials

For instant evaluation, the system is pre-seeded with a default administrator account:
- **Email**: `admin@sentrx.edu`
- **Password**: `Admin@EduGuard2026!`

Users can also register any new administrator account on the **Register** page; all accounts are securely retained in `backend/data/accounts.json`.

---

## 5. Verification & Testing

The backend includes a comprehensive 28-test verification suite covering API contracts, data integrity, security rule detection, fallback mechanics, and authentication:

```bash
PYTHONPATH=./backend pytest ./backend/tests
```

All 28 tests pass with 100% verification.

---

## 6. Safety & Student Privacy Invariant

Recording an administrator decision (`approve`, `reject`, or `escalate`) creates an immutable audit record of administrator review. **No student records, permissions, or system credentials are automatically altered**, ensuring complete human-in-the-loop compliance and zero accidental data exposure.

---

@all rights reserved by SentrX 2026
