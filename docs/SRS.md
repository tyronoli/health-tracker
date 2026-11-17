# SRS: Software Requirements Specification: Health Tracker

**Status:** Draft v1.1 | **Last updated:** 2026-11-17
**Related docs:** `PRD.md` (what and why), `API.md` (interfaces), `architecture.md` (design), `../TASK.md` (plan)

Requirement language: **shall** = mandatory. Priority: **M** Must, **S** Should, **C** Could. Version: **V1** or **V2**.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of Health Tracker, a web application for tracking medications, doses, refills, and appointments, with consent-based caregiver access and (in V2) an AI assistant.

### 1.2 Scope
A Django/PostgreSQL backend exposing a JSON REST API, a React single-page application packaged as a PWA, background workers for reminders, and (V2) an LLM-based assistant. The system is a personal tracker. It is not a medical device and does not provide medical advice.

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Patient / owner | A user whose health data is stored |
| Caregiver | A user who accesses another user's profile through a care link |
| Care link | A consent record between a caregiver and a recipient with status and permission |
| Recipient | The user who owns the data a caregiver is accessing |
| Profile | The data belonging to one user (medications, doses, appointments) |
| Dose | One scheduled intake of a medication at a specific time |
| Dose log | The recorded outcome of a dose: taken, skipped, or missed |
| Grace period | Minutes after a scheduled time before an unlogged dose becomes missed |
| PWA | Progressive Web App, installable web app with a service worker |
| Tool | A fixed server function the assistant may call, never raw database access |

### 1.4 References
`PRD.md`, `API.md`, `architecture.md`, `TASK.md`.

---

## 2. Overall description

### 2.1 Product perspective
Browser client (React PWA) talks to a Django REST API over HTTPS using session authentication. PostgreSQL stores data. Celery workers with Redis run scheduled jobs and send email and web push notifications. In V2, an assistant module calls an LLM provider (hosted or local).

### 2.2 User classes
Patient, caregiver, and care recipient (see PRD section 4). There is no admin user class in the product. A Django admin site exists for the developer in development only.

### 2.3 Operating environment
- Server: Linux, Python 3.12+, Django 5, PostgreSQL 16, Redis
- Development: WSL 2 (Ubuntu) on Windows, Postgres and Redis in Docker
- Client: current Chrome, Edge, Firefox, Safari; mobile browsers. Web push on iOS requires the PWA installed to the home screen.

### 2.4 Constraints
- C-1: Single developer, practice project, fake data only.
- C-2: Backend framework is Django with Django REST Framework.
- C-3: Authentication uses Django sessions with CSRF protection, not hand-rolled auth.
- C-4: All timestamps are stored in UTC.
- C-5: The system shall not give medical advice.

### 2.5 Assumptions and dependencies
- An email provider is available (console backend in development).
- Browsers support the Push API and service workers.
- (V2) An LLM provider is reachable, or a local model is running.

---

## 3. Functional requirements

### 3.1 Accounts (ACC)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| ACC-1 | The system shall let a visitor register with a unique email and a password that passes password validation. | M | V1 |
| ACC-2 | The system shall let a user log in with email and password and log out. | M | V1 |
| ACC-3 | The system shall maintain sessions with secure, HttpOnly cookies and enforce CSRF protection on state-changing requests. | M | V1 |
| ACC-4 | The system shall store a timezone (IANA name) for each user and let the user change it. | M | V1 |
| ACC-5 | The system shall reject unauthenticated requests to any protected endpoint. | M | V1 |
| ACC-6 | The system shall let a user change their password. | S | V1 |
| ACC-7 | The system shall support password reset by emailed link. | S | V1 |
| ACC-8 | The system shall let a user delete their account and all associated data. | S | V1 |
| ACC-9 | The system shall let a user export their data as JSON. | S | V1 |
| ACC-10 | Login and registration responses shall not reveal whether an email already has an account beyond what is unavoidable. | S | V1 |

### 3.2 Care links and authorization (CARE)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| CARE-1 | A caregiver shall be able to invite a user by email, requesting `view` or `edit` permission. | M | V1 |
| CARE-2 | A care link shall start as `pending` and grant no access until the recipient accepts. | M | V1 |
| CARE-3 | The recipient shall be able to accept (optionally with a lower permission), decline, change the permission of, or revoke a link at any time. | M | V1 |
| CARE-4 | The caregiver shall also be able to end a link. | M | V1 |
| CARE-5 | A revoked or declined link shall grant no access, effective immediately. | M | V1 |
| CARE-6 | Every request that reads or writes a user's data shall be authorized by one shared function, `can_access_profile(request_user, target_user, write)`. | M | V1 |
| CARE-7 | A user with `view` permission shall be able to read but not modify the recipient's data; `edit` shall allow modification. | M | V1 |
| CARE-8 | The system shall provide a list of profiles the current user may access (self plus active recipients). | M | V1 |
| CARE-9 | Care links shall not allow a user to link to themselves or to create duplicate active links between the same pair. | M | V1 |

### 3.3 Medications (MED)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| MED-1 | The system shall let an authorized user create, read, update, and deactivate medications with name, dosage, instructions, pills remaining, and refill threshold. | M | V1 |
| MED-2 | Deactivating a medication shall retain its schedules and dose history. | M | V1 |
| MED-3 | Name shall be required; pills remaining and threshold shall be non-negative integers. | M | V1 |
| MED-4 | Medication lists shall be filterable by active status. | S | V1 |

### 3.4 Schedules and doses (DOSE)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| DOSE-1 | A medication shall support multiple schedules, each with time of day, days of week, start date, optional end date, and pills per dose. | M | V1 |
| DOSE-2 | Times of day shall be interpreted in the owner's timezone; due doses shall be stored and compared in UTC. | M | V1 |
| DOSE-3 | The system shall compute the doses due on a given date for a user, including correct handling of daylight-saving changes. | M | V1 |
| DOSE-4 | The system shall let an authorized user record a due dose as `taken` or `skipped`. | M | V1 |
| DOSE-5 | The system shall reject a second log for the same schedule and scheduled time. | M | V1 |
| DOSE-6 | The system shall mark an unlogged dose as `missed` once the grace period (default 60 minutes) has passed. | M | V1 |
| DOSE-7 | The system shall let a user correct a previously logged dose's status and shall adjust pill counts accordingly. | S | V1 |
| DOSE-8 | The system shall provide a Today view and a filterable history (date range, medication, status). | M | V1 |
| DOSE-9 | The system shall let a user log an unscheduled (as-needed) dose. | S | V1 |
| DOSE-10 | The system shall provide an adherence summary over a chosen period. | C | V1 |

### 3.5 Refills (REF)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| REF-1 | When a dose is logged as `taken`, pills remaining shall decrease by pills per dose, never below zero. | M | V1 |
| REF-2 | Logging `skipped` or `missed` shall not change pills remaining. | M | V1 |
| REF-3 | The system shall estimate days of supply left from pills remaining and active schedules. | M | V1 |
| REF-4 | A medication shall be flagged low-supply when pills remaining is at or below its threshold. | M | V1 |
| REF-5 | The system shall send one low-supply alert when the threshold is crossed and not repeat until the supply is replenished above it. | M | V1 |
| REF-6 | A user shall be able to record a refill that adds pills. | M | V1 |

### 3.6 Appointments (APPT)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| APPT-1 | The system shall let an authorized user create, read, update, and delete appointments with title, provider, location, start time, optional duration, and notes. | M | V1 |
| APPT-2 | The system shall list upcoming appointments and support a date-range query for calendar display. | M | V1 |
| APPT-3 | Appointment times shall be stored in UTC and displayed in the viewer's timezone. | M | V1 |

### 3.7 Notifications (NOTIF)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| NOTIF-1 | The system shall send an email reminder for each due dose when email notifications are enabled. | M | V1 |
| NOTIF-2 | The system shall send a web push notification for each due dose when push is enabled and a subscription exists. | M | V1 |
| NOTIF-3 | Each reminder shall be sent at most once per dose, even if the worker runs more than once or restarts. | M | V1 |
| NOTIF-4 | The system shall send an appointment reminder at a configurable lead time (default 24 hours). | M | V1 |
| NOTIF-5 | The system shall let a user turn email and push on or off and set the lead time and grace period. | S | V1 |
| NOTIF-6 | The system shall let a user register and remove push subscriptions per device and send a test notification. | M | V1 |
| NOTIF-7 | Reminders for a profile shall go to that profile's owner. Caregiver alerts are out of scope for V1. | M | V1 |
| NOTIF-8 | Invalid or expired push subscriptions shall be removed when the push service reports them gone. | S | V1 |

### 3.8 Client application (UI)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| UI-1 | The client shall provide screens for login/register, Today, medications, medication detail with schedules, history, appointments (list and calendar), care circle, and settings. | M | V1 |
| UI-2 | The client shall show a profile switcher and always label whose data is displayed. | M | V1 |
| UI-3 | The client shall be usable on a phone-sized screen and installable as a PWA. | M | V1 |
| UI-4 | The client shall display a "tracker only, not medical advice" notice. | M | V1 |
| UI-5 | The client shall show clear errors for validation, permission, and network failures. | M | V1 |

### 3.9 AI assistant (AI) (Version 2)
| ID | Requirement | Pri | Ver |
|---|---|---|---|
| AI-1 | The system shall provide a chat interface that streams the assistant's reply as it is generated. | M | V2 |
| AI-2 | The system shall store conversations and messages per user and let the user list, open, and delete them. | M | V2 |
| AI-3 | Each conversation shall be bound on the server to one profile the user is authorized to access. | M | V2 |
| AI-4 | The assistant shall access data only through fixed read-only tools: list upcoming appointments, get today's doses, list low-supply medications, get dose history. | M | V2 |
| AI-5 | Tools shall obtain the user and profile from the server-side conversation, never from model-provided arguments, and shall call `can_access_profile`. | M | V2 |
| AI-6 | The assistant shall not provide diagnosis, dosing advice, or advice to change or stop medication, and shall suggest consulting a doctor or pharmacist. | M | V2 |
| AI-7 | The system shall treat stored free text (notes, instructions) as data and not as instructions to the assistant. | M | V2 |
| AI-8 | The agent loop shall enforce a maximum number of tool steps and a request timeout. | M | V2 |
| AI-9 | The system shall enforce per-user rate limits and a daily token budget. | M | V2 |
| AI-10 | The system shall provide a selectable LLM provider (hosted or local) through a single interface. | S | V2 |
| AI-11 | The chat interface shall state that the assistant is an AI and not medical advice. | M | V2 |
| AI-12 | The project shall include an evaluation set covering normal lookups, tool use, medical-advice requests, cross-user data requests, and prompt injection, with a repeatable runner. | M | V2 |
| AI-13 | The assistant shall be read-only in V2. It shall not create, modify, or delete user data. | M | V2 |
| AI-14 | The system shall support retrieval over appointment notes. | C | V2 |

---

## 4. External interface requirements

### 4.1 User interface
Responsive web UI; large tap targets for Taken/Skip; keyboard navigable; labels and error messages readable by screen readers.

### 4.2 API
JSON over HTTPS under `/api/`. Defined in `API.md`. Session cookie plus `X-CSRFToken` header on unsafe methods.

### 4.3 Email
SMTP or provider API. Messages: dose reminder, appointment reminder, low-supply alert, care-link invitation, password reset.

### 4.4 Web push
Web Push protocol with VAPID keys through a service worker and the `pywebpush` library.

### 4.5 LLM provider (V2)
HTTPS API of a hosted provider, or a local server such as Ollama. Accessed only through the `assistant` module's client layer.

---

## 5. Data requirements

### 5.1 Entities
| Entity | Key fields |
|---|---|
| User | id, email (unique), password hash, display name, timezone |
| CareLink | id, caregiver, recipient, permission (`view`/`edit`), status (`pending`/`active`/`declined`/`revoked`), timestamps |
| Medication | id, owner, name, dosage, instructions, pills_remaining, refill_threshold, active, low_supply_alert_sent_at |
| Schedule | id, medication, time_of_day, days_of_week, start_date, end_date, pills_per_dose, active |
| DoseLog | id, medication, schedule (nullable), scheduled_for (UTC), status (`taken`/`skipped`/`missed`), logged_at, reminder_sent_at, note |
| Appointment | id, owner, title, provider_name, location, starts_at (UTC), duration_minutes, notes, reminder_sent_at |
| NotificationSettings | user, email_enabled, push_enabled, appointment_reminder_minutes, missed_dose_grace_minutes |
| PushSubscription | id, user, endpoint, keys, user_agent, created_at |
| Conversation (V2) | id, owner, profile, title, created_at |
| Message (V2) | id, conversation, role (`user`/`assistant`/`tool`), content, tool metadata, created_at |

### 5.2 Integrity rules
- A DoseLog is unique per (schedule, scheduled_for).
- A CareLink is unique per (caregiver, recipient) while active or pending, and caregiver is not recipient.
- Pills remaining is never negative.
- Deleting a user deletes all owned data and care links.

### 5.3 Retention
- Health data is kept until the owner deletes it or the account.
- Assistant conversations: retention period to be decided in V2-7; the user shall always be able to delete them.
- Logs shall not contain medication names, notes, or message content.

---

## 6. Non-functional requirements

### 6.1 Security
| ID | Requirement |
|---|---|
| SEC-1 | Passwords shall be hashed with a Django-supported strong hasher; never stored or logged in plaintext. |
| SEC-2 | Session cookies shall be HttpOnly, SameSite=Lax or stricter, and Secure in production. |
| SEC-3 | The application shall be served over HTTPS in production, with HSTS. |
| SEC-4 | Every API endpoint shall have an automated test proving that an unauthorized user is denied. |
| SEC-5 | Login, registration, password reset, and invite endpoints shall be rate limited. |
| SEC-6 | Secrets (secret key, database credentials, VAPID private key, API keys) shall come from environment variables and never be committed. |
| SEC-7 | Object-level authorization failures shall not reveal whether an object exists (return 404 for inaccessible objects). |
| SEC-8 | Production error responses shall not expose stack traces. |

### 6.2 Privacy
| ID | Requirement |
|---|---|
| PRIV-1 | Development and demos shall use fake data only. |
| PRIV-2 | The system shall collect only the data needed for its features. |
| PRIV-3 | Users shall be able to export and delete their data. |
| PRIV-4 | (V2) The data sent to an LLM provider and the data stored shall be documented; the default shall minimize both. |
| PRIV-5 | The project makes no claim of HIPAA, GDPR, or other regulatory compliance. Real users would require a separate legal and security review. |

### 6.3 Performance
| ID | Requirement |
|---|---|
| PERF-1 | Typical list endpoints shall respond in under 500 ms (95th percentile) with a few thousand rows on a development machine. |
| PERF-2 | A due-dose reminder shall be sent within 60 seconds of its scheduled time. |
| PERF-3 | (V2) The first assistant token shall begin streaming within a few seconds on the chosen provider. |

### 6.4 Reliability and correctness
| ID | Requirement |
|---|---|
| REL-1 | Dose logging shall be idempotent against double taps and retries (one record per dose). |
| REL-2 | Reminder jobs shall be idempotent and safe to retry. |
| REL-3 | Timezone and daylight-saving changes shall not cause missed or duplicate reminders (covered by tests). |
| REL-4 | Database changes shall go through migrations. |

### 6.5 Usability and accessibility
- Logging a dose shall take one tap from the Today screen.
- Target WCAG 2.1 AA for contrast, labels, and keyboard use.
- Plain-language error messages.

### 6.6 Maintainability and quality
- Business logic in service modules, not views.
- Automated tests (pytest) for models, services, and permissions; linting (ruff) and type checks (mypy) pass before each commit.
- Documentation (`README`, this SRS, `API.md`) kept in step with the code.

### 6.7 Compatibility
Latest two versions of Chrome, Edge, Firefox, and Safari. Phone browsers supported. Push on iOS only for an installed PWA.

---

## 7. Key use cases

**UC-1 Log a dose.** Actor: patient or editing caregiver. Precondition: a dose is due or recently due. Flow: open Today, tap Taken. System records the log, decrements pills, checks low-supply. Alternate: dose already logged, so the system returns a conflict and the UI shows the existing status.

**UC-2 Link a caregiver.** Actor: caregiver, recipient. Flow: caregiver invites by email; recipient receives the invite; recipient accepts (view or edit). System activates the link. Alternate: recipient declines or never responds, so the link grants no access.

**UC-3 Revoke access.** Actor: recipient or caregiver. Flow: open care circle, choose Revoke. System sets the link to revoked; the next caregiver request for that profile is denied.

**UC-4 Receive a reminder.** Actor: system, patient. Flow: scheduler finds due doses, checks `reminder_sent_at` is empty, sends email and push, sets `reminder_sent_at`.

**UC-5 Low-supply alert.** Actor: system. Flow: a taken dose brings pills at or below the threshold with no alert flag set; system sends an email and sets the flag; refilling above the threshold clears the flag.

**UC-6 Ask the assistant (V2).** Actor: user. Flow: open chat for a profile; send a question; assistant calls read-only tools bound to that profile; reply streams back; messages are stored. Alternate: question asks for medical advice, so the assistant declines and suggests a clinician.

## 8. Acceptance and traceability

| Requirements | Verified by | Build task |
|---|---|---|
| ACC-* | Auth tests | V1-1 |
| CARE-* | Permission tests (owner, stranger, pending, revoked, view vs edit) | V1-2 |
| MED-* | Medication API tests | V1-3 |
| DOSE-* | Service and timezone tests | V1-4 |
| REF-* | Refill service tests | V1-5 |
| APPT-* | Appointment tests | V1-6 |
| NOTIF-*, REL-2, REL-3, PERF-2 | Celery task tests, manual 2-minute reminder test | V1-7 |
| SEC-*, PRIV-* | Authorization audit, settings review | V1-8 |
| AI-* | Unit tests, tool permission tests, eval set | V2-0 to V2-9 |

## 9. Out of scope
Medical advice, drug-interaction checks, pharmacy or clinic integrations, native apps, billing, multi-organization features, regulatory compliance, assistant write actions (V2).