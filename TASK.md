# TASK.md: Health Tracker roadmap

**Stack:** Django 5 + Django REST Framework, PostgreSQL (Docker), Celery + Redis, React + Vite PWA. Developed in WSL (Ubuntu).
**Rule:** one task at a time. Write the tests, make them pass, commit, then tick the box.
**Data rule:** fake data only. Never put real medical information in the app while building.

Legend: `[ ]` to do, `[x]` done. Every task ends with a **Done when** line. If you can't tick it, the task isn't finished.

---

# VERSION 1: core tracker (no AI)

## V1-0. Environment and project setup
- [ ] WSL 2 + Ubuntu working; `.wslconfig` memory cap set
- [ ] Repo created in `~/health-tracker`, `.gitignore`, `docs/` copied in
- [ ] `docker-compose.yml` with Postgres; `docker compose up -d db` works
- [ ] Django project `config`, `apps/accounts` with custom `User` (timezone field) created BEFORE first migrate
- [ ] Settings read from environment variables; `.env.example` up to date
- [ ] pytest + pytest-django, ruff, mypy configured; one passing smoke test
- [ ] First commit
- **Done when:** `runserver` shows the welcome page, `migrate` runs cleanly, `pytest`, `ruff check .` and `mypy .` all pass, `.env` is not tracked by git.

## V1-1. Accounts
- [ ] Email as the login field (change `USERNAME_FIELD`), unique email
- [ ] API: register, login, logout, `me` (get and update timezone)
- [ ] Session auth + CSRF working with a test client
- [ ] Password validation on register
- [ ] Tests: register, wrong password, logout, `me` rejects anonymous users
- **Done when:** you can register and log in with `curl` or the browser, and anonymous requests to `me` get 401/403.

## V1-2. Care links and the permission helper
- [ ] `CareLink` model: caregiver, recipient, permission (`view` | `edit`), status (`pending` | `active` | `revoked`)
- [ ] Endpoints: invite by email, accept, decline, revoke (either side can revoke)
- [ ] `can_access_profile(request_user, target_user, write=False)` in one place
- [ ] Tests: owner allowed; stranger denied; pending link denied; revoked link denied; `view` link cannot write
- **Done when:** the permission tests above all pass. This helper gates every later endpoint, so don't move on until it's solid.

## V1-3. Medications
- [ ] `Medication` model: owner, name, dosage, instructions, pills_remaining, refill_threshold, active
- [ ] CRUD API; reads accept `?profile=<user_id>` and go through the permission helper
- [ ] Tests: list shows only permitted data; caregiver with `view` can read but not edit
- [ ] Frontend: medication list and add/edit form
- **Done when:** user A cannot see or change user B's medications, proven by tests.

## V1-4. Schedules and dose log
- [ ] `Schedule` model: medication, time_of_day, days_of_week, start_date, end_date, active
- [ ] Service function: "doses due on date D for user U", correct in the user's timezone, stored in UTC
- [ ] `DoseLog` model: medication, scheduled_for (UTC), status (`taken` | `skipped` | `missed`), logged_at
- [ ] Endpoints: today's doses, mark taken, mark skipped, history list
- [ ] Management command to mark unlogged doses as `missed` after a grace period (60 min default)
- [ ] Tests: timezone edge cases (late night, different zones), duplicate logging blocked
- [ ] Frontend: "Today" screen with Taken / Skip buttons; history page
- **Done when:** the Today screen shows the right doses for your timezone and logging a dose twice is rejected.

## V1-5. Refill tracking
- [ ] Decrement `pills_remaining` in a service function when a dose is logged `taken` (never go below 0)
- [ ] "Days of supply left" calculation from the schedule
- [ ] Low-supply flag when below threshold
- [ ] Manual "I refilled" action to add pills
- [ ] Tests: decrement, undo/skip does not decrement, threshold crossing
- [ ] Frontend: low-supply indicator on the medication list
- **Done when:** taking doses reduces supply, and the low-supply flag appears exactly once when crossing the threshold.

## V1-6. Appointments
- [ ] `Appointment` model: owner, title, provider_name, location, starts_at (UTC), notes
- [ ] CRUD API through the permission helper
- [ ] Upcoming list and a calendar (month) view
- [ ] Tests: permissions, timezone display
- **Done when:** appointments show at the right local time and caregivers see them only with an active link.

## V1-7. Reminders
- [ ] Add Redis to `docker-compose.yml`
- [ ] Celery + django-celery-beat configured; worker and beat run locally
- [ ] Task: find doses due now (per user timezone) and send an email reminder; idempotent via `reminder_sent_at`
- [ ] Task: appointment reminder (e.g. 24 hours before)
- [ ] Task: low-supply email alert (once per crossing)
- [ ] Task: mark missed doses (replace the management command)
- [ ] Web Push: service worker, VAPID keys, `PushSubscription` model, subscribe endpoint, `pywebpush` sender
- [ ] PWA manifest and install flow (note: iPhone push only works when installed to the home screen)
- [ ] Tests: reminder fires once, not twice, around timezone and daylight-saving changes
- **Done when:** a dose scheduled 2 minutes from now produces exactly one email and one push notification.

## V1-8. Hardening
- [ ] Authorization audit: every endpoint has a test proving another user gets 403/404
- [ ] Rate limiting on login and invite endpoints
- [ ] Production-style settings: `DEBUG=false`, secure cookies, HTTPS-only, allowed hosts, CSRF trusted origins
- [ ] Consistent error responses; no stack traces to users
- [ ] Seed command that creates FAKE demo users and data
- [ ] Add a visible "tracker only, not medical advice" notice
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
- [ ] All V1 tasks ticked
- [ ] `pytest`, `ruff`, `mypy`, frontend lint and tests all green
- [ ] No secrets in git history
- [ ] Tag the commit `v1.0`

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