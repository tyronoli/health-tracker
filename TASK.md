# TASK.md: Health Tracker roadmap

**Stack:** Django 5 + Django REST Framework, PostgreSQL (Docker), Celery + Redis, React + Vite PWA. Developed in WSL (Ubuntu).
**Rule:** one task at a time. Write the tests, make them pass, commit, then tick the box.
**Data rule:** fake data only. Never put real medical information in the app while building.

Legend: `[ ]` to do, `[x]` done. Every task ends with a **Done when** line. If you can't tick it, the task isn't finished.

**Suggested order of work:** V1-0 to V1-5 (backend, done), V1-F1 to V1-F4 (frontend), V1-6 then V1-F5, V1-7 then V1-F6, V1-8, V1-9 (optional).
Backend tasks hold only backend items. Each one points to the frontend task (V1-F) that builds its screens.

---

# VERSION 1: core tracker (no AI)

## V1-0. Environment and project setup
- [x] WSL 2 + Ubuntu working; `.wslconfig` memory cap set
- [x] Repo created in `~/health-tracker`, `.gitignore`, `docs/` copied in
- [x] `docker-compose.yml` with Postgres; `docker compose up -d db` works
- [x] Django project `config`, `apps/accounts` with custom `User` (timezone field) created BEFORE first migrate
- [x] Settings read from environment variables; `.env.example` up to date
- [x] pytest + pytest-django, ruff, mypy configured; one passing smoke test
- [x] First commit
- **Done when:** `runserver` shows the welcome page, `migrate` runs cleanly, `pytest`, `ruff check .` and `mypy .` all pass, `.env` is not tracked by git.

## V1-1. Accounts
- [x] Email as the login field (change `USERNAME_FIELD`), unique email
- [x] API: register, login, logout, `me` (get and update timezone)
- [x] Session auth + CSRF working with a test client
- [x] Password validation on register
- [x] Tests: register, wrong password, logout, `me` rejects anonymous users
- UI for this task: see V1-F1
- **Done when:** you can register and log in with `curl` or the browser, and anonymous requests to `me` get 401.

## V1-2. Care links and the permission helper
- [x] `CareLink` model: caregiver, recipient, permission (`view` | `edit`), status (`pending` | `active` | `declined` | `revoked`), database constraints (no self-link, one open link per pair)
- [x] Endpoints: invite by email (same response whether or not the account exists), accept (optionally with lower permission), decline, revoke (either side), change permission (recipient), list with filters
- [x] `GET /api/profiles/` for the profile switcher
- [x] `can_access_profile`, `get_target_profile` and `check_object_access` in one module
- [x] Tests: owner allowed; stranger denied; pending, declined and revoked links denied; `view` link cannot write; access is one-directional
- UI for this task: see V1-F4 (profile switcher in V1-F2)
- **Done when:** the permission tests above all pass. This helper gates every later endpoint, so don't move on until it's solid.

## V1-3. Medications
- [x] `Medication` model: owner, name, dosage, instructions, pills_remaining, refill_threshold, active
- [x] CRUD API with soft delete; reads accept `?profile=<user_id>` and go through the permission helper
- [x] "I refilled" action (`POST /api/medications/{id}/refill/`)
- [x] Tests: caregiver permission matrix (six link states against list, get, create, patch, delete, refill)
- UI for this task: see V1-F3
- **Done when:** user A cannot see or change user B's medications, proven by tests.

## V1-4a. Schedules
- [x] `Schedule` model: medication, time_of_day, days_of_week, start_date, end_date, pills_per_dose, active, tracking_started_at
- [x] Service function: doses due on date D in the owner's timezone (stored in UTC), correct across daylight-saving changes
- [x] Schedule API nested under medications, with permission matrix tests
- UI for this task: see V1-F3 (schedule editor)
- **Done when:** the DST tests pass and every caregiver link state gets the right status code.

## V1-4b. Dose log
- [x] `DoseLog` model (`taken` | `skipped` | `missed`), unique per schedule and time
- [x] Endpoints: today's doses, log a dose, correct a log, history with filters
- [x] Missed-dose job (management command) with a 60-minute grace period; history is frozen before a schedule is edited or deleted
- [x] Tests: timezone edge cases, duplicate logging blocked (409), late dose after missed, caregiver matrix
- UI for this task: see V1-F2 (Today) and V1-F4 (history)
- **Done when:** logging a dose twice is rejected, and Today shows the right pending, missed, taken and skipped doses for the owner's local day.

## V1-5. Refill tracking
- [x] Taking a dose deducts `pills_per_dose` (never below 0); each log remembers `pills_used`
- [x] Undo and corrections return exactly what was deducted; skipped and missed leave the count alone
- [x] `days_supply_left` estimate from the schedules in effect
- [x] Low-supply flag, `GET /api/refills/low-supply/`, and a one-time alert marker (`low_supply_alert_raised_at`) raised on a downward crossing
- [x] Tests: decrement, undo, never negative, atomic with duplicates, threshold crossing
- UI for this task: see V1-F3 (low-supply badge)
- **Done when:** taking doses reduces supply, and the alert marker is raised exactly once per crossing.

---

## V1-F. Frontend (React + Vite + TypeScript + Tailwind PWA)

### V1-F1. Scaffold and authentication
- [x] Node 20+ installed in WSL (via nvm); `frontend/` created with Vite, React, TypeScript, Tailwind
- [x] Dev proxy: `/api` requests go to Django so cookies and CSRF stay same-origin
- [x] API client: JSON, CSRF header, and the standard `{"error": {...}}` shape
- [x] AuthContext: load `me`, register, login, logout
- [x] Pages: Login and Register; protected routes
- [x] Tests (vitest + Testing Library): API client and login form
- **Done when:** you can register, log in, refresh and stay logged in, and log out.

### V1-F2. Today screen and profile switcher
- [x] ProfileContext from `/api/profiles/`, plus a switcher that always shows whose data is on screen
- [x] Today: due doses with Taken and Skip buttons, undo, and handling of 403 and 409
- **Done when:** logging a dose updates the screen, and a view-only caregiver sees no write buttons.

### V1-F3. Medications
- [x] List with low-supply badge and "days left", add/edit form, schedule editor, refill button
- **Done when:** you can set up a medication with schedules entirely from the UI.

### V1-F4. History and care circle
- [x] History with filters (date, medication, status)
- [x] Care circle page: invite, accept, decline, revoke, change permission
- **Done when:** two browser sessions can link, share, and revoke access through the UI.

### V1-F5. Appointments UI (after V1-6)
- [ ] Upcoming list, month calendar, add/edit/delete form
- **Done when:** appointments show at the right local time for the viewed profile.

### V1-F6. Settings and notifications UI (after V1-7)
- [ ] Notification settings, push permission and subscription flow, PWA install prompt
- **Done when:** you can turn email and push on or off and receive a test notification.

---

## V1-6. Appointments
- [ ] `Appointment` model: owner, title, provider_name, location, starts_at (UTC), duration_minutes, notes
- [ ] CRUD API through the permission helper (`check_object_access` for single objects)
- [ ] List endpoint with `from`/`to` for the calendar and `upcoming=true`
- [ ] Tests: caregiver permission matrix, timezone handling, same-404 for missing and forbidden
- UI for this task: see V1-F5
- **Done when:** appointments show at the right local time and caregivers see them only with an active link.

## V1-7. Reminders
- [ ] Add Redis to `docker-compose.yml`
- [ ] Celery + django-celery-beat configured; worker and beat run locally
- [ ] `NotificationSettings` model and endpoints (email on/off, push on/off, appointment lead time, missed-dose grace period); the grace period becomes per-user instead of the global setting
- [ ] Task: find doses due now (per user timezone) and send an email reminder; idempotent via `reminder_sent_at`
- [ ] Task: appointment reminder (e.g. 24 hours before)
- [ ] Task: low-supply email alert, sent when `low_supply_alert_raised_at` is set and not yet emailed
- [ ] Email: care-link invitation
- [ ] Task: mark missed doses (replace the management command)
- [ ] Web Push: service worker, VAPID keys, `PushSubscription` model, subscribe endpoint, `pywebpush` sender
- [ ] PWA manifest and install flow (note: iPhone push only works when installed to the home screen)
- [ ] Tests: reminder fires once, not twice, around timezone and daylight-saving changes
- UI for this task: see V1-F6
- **Done when:** a dose scheduled 2 minutes from now produces exactly one email and one push notification.

## V1-8. Hardening
- [ ] Authorization audit: every endpoint has a test proving another user gets 403/404
- [ ] Rate limiting on login, register and invite endpoints
- [ ] Concurrency: lock rows when care links change state (two simultaneous actions can't both win)
- [ ] Account features: password change and reset by email, account deletion, data export
- [ ] Production-style settings: `DEBUG=false`, secure cookies, HTTPS-only, allowed hosts, CSRF trusted origins
- [ ] Consistent JSON errors, including unknown `/api/` routes; no stack traces to users
- [ ] Seed command that creates FAKE demo users and data
- [ ] Add a visible "tracker only, not medical advice" notice
- [ ] Docs match the code: generate an OpenAPI schema (e.g. drf-spectacular) and update `API.md` and `architecture.md`
- [ ] README: how to run, test, and reset everything
- **Done when:** the audit checklist is complete and a fresh clone runs from the README alone.

## V1-9. Deploy (optional, can be skipped for a practice project)
- [ ] Choose a host; set environment variables and secrets there
- [ ] Postgres + Redis managed or containerised; run migrations
- [ ] Run the web process, Celery worker and Celery beat
- [ ] HTTPS on, static files served, error monitoring added
- [ ] Database backup plan
- **Done when:** you can install the PWA on your phone from the live URL and receive a push reminder. Use fake data only.

## V1 release checklist
- [ ] All V1 tasks ticked, including V1-F1 to V1-F6
- [ ] `pytest`, `ruff`, `mypy`, frontend lint, `tsc` and frontend tests all green
- [ ] No secrets in git history
- [ ] Tag the commit `v1.0`

## Ideas parked for later (not v1)
- As-needed doses with no schedule (logging an extra dose)
- Adherence summary endpoint (`/api/doses/adherence/`)
- Caregiver alert when a dose is missed
- Fewer queries for list endpoints that compute estimates

---

# VERSION 2: AI assistant (chat with an AI agent)

**Prerequisite:** V1 finished, especially V1-2 and V1-8 (permissions). The assistant reads health data, so it must obey the same rules as everything else.
**Scope for v2:** read-only. The assistant looks things up and summarizes. It does not change data and does not give medical or dosing advice.

## V2-0. Decisions before coding
- [ ] Provider: hosted LLM API, local model (Ollama), or both behind one interface
- [ ] Placement: a Django app (`apps/assistant`) first; separate FastAPI service only if you need it later
- [ ] Data policy: what is sent to the model, what is stored, how long
- **Done when:** the three decisions are written down in `docs/architecture.md`.

## V2-1. Conversation storage
- [ ] `Conversation` and `Message` models (owner, role, content, created_at)
- [ ] API: create conversation, list mine, get messages, delete conversation
- [ ] Tests: users can only see their own conversations
- **Done when:** deleting a conversation really removes its messages.

## V2-2. LLM client layer
- [ ] One module (`assistant/llm.py`) that all model calls go through
- [ ] Provider chosen by environment variable; timeouts and error handling
- [ ] Tests with a fake provider so tests never call a real model
- **Done when:** you can switch between providers by changing one setting.

## V2-3. Streaming chat endpoint and UI
- [ ] Endpoint that streams the reply as it is generated (async view or streaming response)
- [ ] Basic chat UI: message list, input box, streaming display, stop button
- [ ] Save user and assistant messages
- **Done when:** text appears token by token in the browser and survives a page refresh.

## V2-4. Tools (read-only)
- [ ] Tool functions: `list_upcoming_appointments`, `get_todays_doses`, `list_low_supply_medications`, `get_dose_history`
- [ ] Each tool takes the logged-in user from the server, never from the model's arguments
- [ ] Each tool goes through `can_access_profile`
- [ ] JSON schemas for the tools; validate arguments before running
- [ ] Tests: a tool can never return another user's data, even if the model asks for it
- **Done when:** the permission tests pass for every tool.

## V2-5. Agent loop
- [ ] Model decides when to call tools; run the tool; feed the result back; repeat
- [ ] Maximum steps per message; timeouts; graceful failure message
- [ ] Truncate large tool results
- [ ] Log each step (tool name, duration, success) without logging sensitive content
- **Done when:** "What appointments do I have this week and are any pills running low?" is answered using two tools.

## V2-6. Safety and behavior
- [ ] System prompt: lookup and summarize only; no diagnosis, no dosing or medication-change advice; suggest asking a doctor or pharmacist
- [ ] Treat stored text (appointment notes, medication instructions) as data, never as instructions to the assistant
- [ ] Refusal and redirect responses for medical-advice questions
- [ ] Visible notice in the chat UI that it is an AI and not medical advice
- **Done when:** your safety test cases in V2-8 all pass.

## V2-7. Privacy and retention
- [ ] Decide and implement: what gets stored, retention period, delete-my-chats button
- [ ] Redact or minimize what is sent to a hosted model; or default to a local model
- [ ] Document the data flow in the README
- **Done when:** you can state exactly what data leaves your machine and when.

## V2-8. Evaluation
- [ ] Build a test set of 30 to 50 questions: normal lookups, tool use, medical-advice traps, other-user data requests, prompt-injection attempts
- [ ] Script that runs the set and reports pass/fail per category
- [ ] Re-run after every prompt, model, or tool change
- **Done when:** you have a baseline pass rate saved, and permission and safety categories are at 100%.

## V2-9. Limits and cost control
- [ ] Per-user rate limit and daily token budget
- [ ] Context-window management for long conversations
- [ ] Clear error messages when limits are hit
- **Done when:** a runaway loop or spammy user cannot run up cost or lock up the server.

## V2-10. Optional extensions
- [ ] Retrieval over appointment notes with pgvector (summarize and search your own notes)
- [ ] Move the assistant into a separate FastAPI service
- [ ] Write actions (e.g. "log my dose") with explicit user confirmation, as a v3 idea

## V2 release checklist
- [ ] All V2 tasks ticked and evals green
- [ ] No endpoint or tool can leak another user's data
- [ ] Tag the commit `v2.0`