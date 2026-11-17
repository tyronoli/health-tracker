# API.md: Health Tracker REST API

**Status:** Draft v1.1 | **Last updated:** 2026-11-17
Base path: `/api/` | Format: JSON (UTF-8) | Version tags: **V1** core, **V2** assistant
Related docs: `SRS.md`, `PRD.md`, `architecture.md`

---

## 1. Conventions

### 1.1 Authentication and CSRF
- Session cookie authentication. The browser sends the cookie automatically (same origin).
- Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) require the CSRF token in the `X-CSRFToken` header. Get the token with `GET /api/auth/csrf/` (sets the `csrftoken` cookie).
- Endpoints marked **Public** need no login. Everything else returns `401` when not logged in.
- Note for implementation: DRF's `SessionAuthentication` returns `403` for anonymous users by default. Add an `authenticate_header` to the authentication class so it returns `401`.

### 1.2 Whose data? The `profile` parameter
Data endpoints work on one user's profile at a time.
- `profile=<user_id>` (query string for reads, body field for creates). Defaults to the current user.
- If the current user has no access to that profile, the response is `403`.
- Access is decided by `can_access_profile(request_user, target_user, write)`: the owner always; a caregiver only through an `active` care link, with `edit` required for writes.
- For a specific object ID (e.g. `/medications/7/`), an object the caller can't access returns `404`, so the existence of other users' data is not revealed.

### 1.3 Formats
| Type | Format | Example |
|---|---|---|
| Datetime | ISO 8601 in UTC with `Z` | `2026-11-18T00:00:00Z` |
| Date | `YYYY-MM-DD` | `2026-11-18` |
| Time of day | `HH:MM` in the owner's timezone | `08:00` |
| Days of week | integers 0 to 6, Monday = 0 | `[0,1,2,3,4]` |
| Timezone | IANA name | `Asia/Manila` |
| IDs | integers | `12` |

### 1.4 Pagination
List endpoints that can grow large accept `page` (default 1) and `page_size` (default 20, max 100):
```json
{ "count": 57, "next": "/api/doses/?page=2", "previous": null, "results": [ ] }
```

### 1.5 Errors
All errors use one shape:
```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields are invalid.",
    "fields": { "pills_remaining": ["Must be 0 or greater."] }
  }
}
```
| Status | Meaning | Typical `code` |
|---|---|---|
| 400 | Invalid input | `validation_error`, `invalid_credentials` |
| 401 | Not logged in | `not_authenticated` |
| 403 | Logged in but not allowed | `permission_denied` |
| 404 | Not found or not visible to you | `not_found` |
| 405 | Method not allowed | `method_not_allowed` |
| 409 | Conflict with current state | `already_logged`, `link_exists` |
| 429 | Rate limited (see `Retry-After` header) | `rate_limited` |
| 500 | Server error (no stack trace in production) | `server_error` |

### 1.6 Rate limits (suggested defaults)
| Scope | Limit |
|---|---|
| Login, register, password reset | 5 per minute per IP and per email |
| Care-link invites | 10 per hour per user |
| General authenticated requests | 120 per minute per user |
| Assistant messages (V2) | 20 per hour per user plus a daily token budget |

---

## 2. Endpoint index

| # | Method | Path | Ver | Purpose |
|---|---|---|---|---|
| **System** | | | | |
| 1 | GET | `/api/health/` | V1 | Health check (Public) |
| **Auth and account** | | | | |
| 2 | GET | `/api/auth/csrf/` | V1 | Set CSRF cookie (Public) |
| 3 | POST | `/api/auth/register/` | V1 | Create account (Public) |
| 4 | POST | `/api/auth/login/` | V1 | Log in (Public) |
| 5 | POST | `/api/auth/logout/` | V1 | Log out |
| 6 | GET | `/api/auth/me/` | V1 | Current user |
| 7 | PATCH | `/api/auth/me/` | V1 | Update name, timezone |
| 8 | DELETE | `/api/auth/me/` | V1 | Delete account and data |
| 9 | POST | `/api/auth/password/change/` | V1 | Change password |
| 10 | POST | `/api/auth/password/reset/` | V1 | Request reset email (Public) |
| 11 | POST | `/api/auth/password/reset/confirm/` | V1 | Set new password (Public) |
| 12 | GET | `/api/export/` | V1 | Download my data as JSON |
| **Care circle** | | | | |
| 13 | GET | `/api/profiles/` | V1 | Profiles I can access |
| 14 | GET | `/api/care-links/` | V1 | My care links |
| 15 | POST | `/api/care-links/` | V1 | Invite a recipient |
| 16 | PATCH | `/api/care-links/{id}/` | V1 | Change permission (recipient) |
| 17 | POST | `/api/care-links/{id}/accept/` | V1 | Accept invite |
| 18 | POST | `/api/care-links/{id}/decline/` | V1 | Decline invite |
| 19 | POST | `/api/care-links/{id}/revoke/` | V1 | End a link |
| **Medications and schedules** | | | | |
| 20 | GET | `/api/medications/` | V1 | List medications |
| 21 | POST | `/api/medications/` | V1 | Create medication |
| 22 | GET | `/api/medications/{id}/` | V1 | Get medication |
| 23 | PATCH | `/api/medications/{id}/` | V1 | Update medication |
| 24 | DELETE | `/api/medications/{id}/` | V1 | Deactivate medication |
| 25 | POST | `/api/medications/{id}/refill/` | V1 | Record a refill |
| 26 | GET | `/api/medications/{id}/schedules/` | V1 | List schedules |
| 27 | POST | `/api/medications/{id}/schedules/` | V1 | Create schedule |
| 28 | PATCH | `/api/schedules/{id}/` | V1 | Update schedule |
| 29 | DELETE | `/api/schedules/{id}/` | V1 | Delete schedule |
| **Doses and refills** | | | | |
| 30 | GET | `/api/doses/today/` | V1 | Today's doses |
| 31 | GET | `/api/doses/` | V1 | Dose history |
| 32 | POST | `/api/doses/` | V1 | Log a dose |
| 33 | PATCH | `/api/doses/{id}/` | V1 | Correct a logged dose |
| 34 | GET | `/api/doses/adherence/` | V1 | Adherence summary (Could) |
| 35 | GET | `/api/refills/low-supply/` | V1 | Low-supply medications |
| **Appointments** | | | | |
| 36 | GET | `/api/appointments/` | V1 | List appointments |
| 37 | POST | `/api/appointments/` | V1 | Create appointment |
| 38 | GET | `/api/appointments/{id}/` | V1 | Get appointment |
| 39 | PATCH | `/api/appointments/{id}/` | V1 | Update appointment |
| 40 | DELETE | `/api/appointments/{id}/` | V1 | Delete appointment |
| **Notifications** | | | | |
| 41 | GET | `/api/notification-settings/` | V1 | Get my settings |
| 42 | PATCH | `/api/notification-settings/` | V1 | Update my settings |
| 43 | GET | `/api/push/vapid-public-key/` | V1 | Public key for subscribing |
| 44 | POST | `/api/push/subscriptions/` | V1 | Register a device |
| 45 | DELETE | `/api/push/subscriptions/{id}/` | V1 | Remove a device |
| 46 | POST | `/api/push/test/` | V1 | Send a test notification |
| **Assistant** | | | | |
| 47 | GET | `/api/assistant/conversations/` | V2 | List my conversations |
| 48 | POST | `/api/assistant/conversations/` | V2 | Start a conversation |
| 49 | GET | `/api/assistant/conversations/{id}/` | V2 | Get conversation with messages |
| 50 | DELETE | `/api/assistant/conversations/{id}/` | V2 | Delete a conversation |
| 51 | DELETE | `/api/assistant/conversations/` | V2 | Delete all my conversations |
| 52 | POST | `/api/assistant/conversations/{id}/messages/` | V2 | Send a message (streams reply) |

---

## 3. System

### GET `/api/health/` (Public)
Returns `200 {"status": "ok"}` if the app and database respond. Used by deploy checks.

---

## 4. Auth and account

### GET `/api/auth/csrf/` (Public)
Sets the `csrftoken` cookie. `204 No Content`. Call it once when the app loads.

### POST `/api/auth/register/` (Public)
```json
{ "email": "alex@example.com", "password": "S0me-long-password", "display_name": "Alex", "timezone": "Asia/Manila" }
```
`201`:
```json
{ "id": 1, "email": "alex@example.com", "display_name": "Alex", "timezone": "Asia/Manila" }
```
Logs the user in. Errors: `400` for invalid email, weak password, or unknown timezone. If the email is already registered, return a generic `400` ("Could not create the account") instead of saying the email exists. Adding email verification later would close this gap completely.

### POST `/api/auth/login/` (Public)
```json
{ "email": "alex@example.com", "password": "S0me-long-password" }
```
`200`: the user object (as above). Sets the session cookie. Errors: `400 invalid_credentials` (same message for unknown email and wrong password), `429`.

### POST `/api/auth/logout/`
`204`. Ends the session.

### GET `/api/auth/me/`
`200`:
```json
{ "id": 1, "email": "alex@example.com", "display_name": "Alex", "timezone": "Asia/Manila" }
```

### PATCH `/api/auth/me/`
Body: any of `display_name`, `timezone`. `200` with the updated user. Email changes are not supported in V1.

### DELETE `/api/auth/me/`
Body: `{ "password": "..." }` to confirm. `204`. Deletes the account, all owned data, and all care links.

### POST `/api/auth/password/change/`
`{ "old_password": "...", "new_password": "..." }` returns `204`. Errors: `400` for a wrong old password or weak new password.

### POST `/api/auth/password/reset/` (Public)
`{ "email": "alex@example.com" }` always returns `204`, whether or not the account exists. If it exists, an email with a one-time link is sent.

### POST `/api/auth/password/reset/confirm/` (Public)
`{ "uid": "...", "token": "...", "new_password": "..." }` returns `204`, or `400` for an invalid or expired token.

### GET `/api/export/`
Returns `200` with a JSON download of the current user's own data (profile, medications, schedules, dose logs, appointments, settings). Rate limited.

---

## 5. Care circle

### GET `/api/profiles/`
Profiles the current user may open: themselves plus recipients of active links.
```json
[
  { "user_id": 1, "display_name": "Alex", "relationship": "self", "permission": "edit" },
  { "user_id": 2, "display_name": "Mum", "relationship": "recipient", "permission": "view" }
]
```
Used by the profile switcher.

### GET `/api/care-links/`
Query: `role=caregiver|recipient` (optional), `status=pending|active|declined|revoked` (optional).
```json
{
  "results": [
    {
      "id": 5,
      "caregiver": { "id": 1, "display_name": "Alex", "email": "alex@example.com" },
      "recipient": { "id": 2, "display_name": "Mum", "email": "mum@example.com" },
      "permission": "view",
      "status": "pending",
      "created_at": "2026-11-17T08:00:00Z",
      "responded_at": null
    }
  ]
}
```
Only links where the current user is the caregiver or the recipient.

### POST `/api/care-links/`
Caregiver invites a recipient.
```json
{ "email": "mum@example.com", "permission": "view" }
```
`201`:
```json
{ "message": "If an account exists for that email, an invitation has been sent." }
```
The response is the same whether or not the account exists, so the endpoint can't be used to find out who has an account. If the account exists, a `pending` link is created and the recipient is notified. Errors: `400` for yourself or an invalid email, `409 link_exists` when an active or pending link already exists, `429`.

### PATCH `/api/care-links/{id}/`
Recipient only. Body: `{ "permission": "view" }` (or `edit`). `200` with the link. Only valid while the link is `active`.

### POST `/api/care-links/{id}/accept/`
Recipient only. Optional body: `{ "permission": "view" }` to accept with a lower level than requested. `200` with the link, status `active`. Errors: `409` if the link is not `pending`.

### POST `/api/care-links/{id}/decline/`
Recipient only. `200` with the link, status `declined`.

### POST `/api/care-links/{id}/revoke/`
Recipient or caregiver. `200` with the link, status `revoked`. Access ends immediately.

---

## 6. Medications and schedules

All endpoints here accept `profile` and are checked by `can_access_profile`.

**Medication object**
```json
{
  "id": 7,
  "owner": 1,
  "name": "Metformin",
  "dosage": "500 mg",
  "instructions": "Take with food",
  "pills_remaining": 24,
  "refill_threshold": 10,
  "active": true,
  "days_supply_left": 12,
  "low_supply": false,
  "created_at": "2026-11-01T02:00:00Z",
  "updated_at": "2026-11-17T01:30:00Z"
}
```
`days_supply_left` (nullable) and `low_supply` are computed and read-only. (The example uses a fake medication.)

### GET `/api/medications/`
Query: `profile`, `active=true|false`, `page`, `page_size`. `200` paginated list.

### POST `/api/medications/`
```json
{ "profile": 1, "name": "Metformin", "dosage": "500 mg", "instructions": "Take with food", "pills_remaining": 30, "refill_threshold": 10 }
```
`201` with the medication. Needs write access to the profile. Errors: `400` (name required, negative numbers), `403`.

### GET `/api/medications/{id}/`
`200` with the medication, or `404`.

### PATCH `/api/medications/{id}/`
Any of `name`, `dosage`, `instructions`, `pills_remaining`, `refill_threshold`, `active`. `200` with the medication.

### DELETE `/api/medications/{id}/`
Deactivates (soft delete) so the dose history is kept. `204`.

### POST `/api/medications/{id}/refill/`
`{ "pills_added": 30 }` returns `200` with the medication. Clears the low-supply alert flag if the supply is back above the threshold. Errors: `400` if the number is not a positive integer.

**Schedule object**
```json
{
  "id": 11,
  "medication": 7,
  "time_of_day": "08:00",
  "days_of_week": [0, 1, 2, 3, 4, 5, 6],
  "start_date": "2026-11-17",
  "end_date": null,
  "pills_per_dose": 1,
  "active": true
}
```

### GET `/api/medications/{id}/schedules/`
`200` list of schedules.

### POST `/api/medications/{id}/schedules/`
Body: `time_of_day`, `days_of_week`, `start_date`, optional `end_date`, optional `pills_per_dose` (default 1). `201` with the schedule. Errors: `400` if the end date is before the start date or the days list is empty.

### PATCH `/api/schedules/{id}/`
Any schedule field. `200`. Changes apply to future doses only; logged doses are not rewritten.

### DELETE `/api/schedules/{id}/`
`204`. Existing dose logs are kept.

---

## 7. Doses and refills

**Dose log object**
```json
{
  "id": 301,
  "medication": 7,
  "schedule": 11,
  "scheduled_for": "2026-11-17T00:00:00Z",
  "status": "taken",
  "logged_at": "2026-11-17T00:03:12Z",
  "note": ""
}
```

### GET `/api/doses/today/`
Query: `profile`. Doses due today in the profile owner's timezone, each with its current state.
```json
{
  "date": "2026-11-17",
  "timezone": "Asia/Manila",
  "doses": [
    {
      "schedule": 11,
      "medication": { "id": 7, "name": "Metformin", "dosage": "500 mg" },
      "scheduled_for": "2026-11-17T00:00:00Z",
      "status": "taken",
      "dose_log_id": 301,
      "pills_per_dose": 1
    },
    {
      "schedule": 12,
      "medication": { "id": 7, "name": "Metformin", "dosage": "500 mg" },
      "scheduled_for": "2026-11-17T12:00:00Z",
      "status": "pending",
      "dose_log_id": null,
      "pills_per_dose": 1
    }
  ]
}
```
`status` is one of `pending`, `taken`, `skipped`, `missed`.

### GET `/api/doses/`
Query: `profile`, `from` and `to` (dates), `medication`, `status`, `page`, `page_size`. `200` paginated list of dose logs, newest first.

### POST `/api/doses/`
Log a dose.
```json
{ "profile": 1, "medication": 7, "schedule": 11, "scheduled_for": "2026-11-17T00:00:00Z", "status": "taken", "note": "" }
```
`201` with the dose log. `status` is `taken` or `skipped`. For an unscheduled (as-needed) dose, omit `schedule` and set `scheduled_for` to the time taken. Effects: a `taken` dose reduces `pills_remaining` by `pills_per_dose` (never below 0) and may trigger the low-supply alert. Errors: `409 already_logged` when that schedule and time already has a log, `400` for an invalid status or a time that does not match the schedule, `403`.

### PATCH `/api/doses/{id}/`
Correct a mistake: `{ "status": "skipped", "note": "..." }`. `200`. Pill counts are adjusted to match the change (taken to skipped adds the pills back). Only `taken` and `skipped` are accepted; `missed` is set by the system.

### GET `/api/doses/adherence/`
Query: `profile`, `days` (default 30, max 365).
```json
{ "days": 30, "scheduled": 60, "taken": 55, "skipped": 2, "missed": 3, "adherence_percent": 91.7 }
```
`adherence_percent` is taken divided by scheduled. Optional (Could).

### GET `/api/refills/low-supply/`
Query: `profile`. `200` list of medications at or below their threshold, each with `days_supply_left`.

---

## 8. Appointments

**Appointment object**
```json
{
  "id": 21,
  "owner": 1,
  "title": "Check-up",
  "provider_name": "Dr. Santos",
  "location": "City Clinic, Room 4",
  "starts_at": "2026-11-25T02:30:00Z",
  "duration_minutes": 30,
  "notes": "Bring medication list",
  "created_at": "2026-11-17T01:00:00Z"
}
```

### GET `/api/appointments/`
Query: `profile`, `from`, `to` (datetimes, for the calendar), `upcoming=true` (only future), `page`, `page_size`. Sorted by `starts_at`.

### POST `/api/appointments/`
Body: `profile` (optional), `title` (required), `starts_at` (required), and optionally `provider_name`, `location`, `duration_minutes`, `notes`. `201`.

### GET / PATCH / DELETE `/api/appointments/{id}/`
Standard behavior: `200`, `200`, `204`. `404` if not visible.

---

## 9. Notifications

### GET `/api/notification-settings/`
```json
{ "email_enabled": true, "push_enabled": true, "appointment_reminder_minutes": 1440, "missed_dose_grace_minutes": 60 }
```
Always the current user's own settings.

### PATCH `/api/notification-settings/`
Any of the four fields. `200`. `appointment_reminder_minutes` and `missed_dose_grace_minutes` must be positive.

### GET `/api/push/vapid-public-key/`
`200 {"public_key": "..."}`. The browser needs it to subscribe.

### POST `/api/push/subscriptions/`
Body from the browser's `PushSubscription.toJSON()`:
```json
{ "endpoint": "https://push.example/abc", "keys": { "p256dh": "...", "auth": "..." }, "user_agent": "Chrome on Android" }
```
`201 {"id": 3}`. Re-posting the same endpoint updates it instead of duplicating.

### DELETE `/api/push/subscriptions/{id}/`
`204`. Only the owner can delete.

### POST `/api/push/test/`
Sends a test notification to the current user's devices. `202`. Rate limited.

---

## 10. Assistant (Version 2)

Every endpoint here works only on the caller's own conversations (`404` otherwise). The assistant is read-only and cannot change any data.

**Conversation object**
```json
{ "id": 4, "profile": 1, "title": "Appointments this week", "created_at": "2026-11-17T03:00:00Z" }
```

**Message object**
```json
{ "id": 90, "role": "assistant", "content": "You have one appointment this week...", "created_at": "2026-11-17T03:00:05Z" }
```

### GET `/api/assistant/conversations/`
Paginated list, newest first.

### POST `/api/assistant/conversations/`
`{ "profile": 1 }` (optional, defaults to the current user). `201` with the conversation. The profile is fixed on the server at creation and checked with `can_access_profile`. The model can never change it.

### GET `/api/assistant/conversations/{id}/`
`200` with the conversation and its `messages` array.

### DELETE `/api/assistant/conversations/{id}/`
`204`. Permanently deletes the conversation and its messages.

### DELETE `/api/assistant/conversations/`
`204`. Deletes all of the caller's conversations.

### POST `/api/assistant/conversations/{id}/messages/`
Send a user message and stream the reply.
```json
{ "content": "What appointments do I have this week?" }
```
Response: `200` with `Content-Type: text/event-stream`. Each event has a name and a JSON `data` line:
```
event: message_start
data: {"message_id": 91}

event: tool_call
data: {"name": "list_upcoming_appointments", "arguments": {"days_ahead": 7}}

event: tool_result
data: {"name": "list_upcoming_appointments", "ok": true}

event: token
data: {"text": "You have one appointment "}

event: message_end
data: {"message_id": 91}
```
On failure an `error` event is sent: `data: {"code": "rate_limited", "message": "..."}`. Errors before streaming starts return normal JSON errors: `404`, `429`, `400` (empty or too-long content).

Client note: the browser's `EventSource` only supports GET, so use `fetch` with a `ReadableStream` for this POST. To stop a reply, abort the request.

#### Assistant tools (internal, not HTTP endpoints)
These are the only functions the model can call. Each runs on the server with the user and profile taken from the conversation. They are never taken from the model's arguments, and each calls `can_access_profile`.

| Tool | Arguments | Returns |
|---|---|---|
| `list_upcoming_appointments` | `days_ahead` (int, 1 to 60, default 7) | Appointments in that window |
| `get_todays_doses` | none | Today's doses and their status |
| `list_low_supply_medications` | none | Medications at or below threshold |
| `get_dose_history` | `days` (int, 1 to 30), optional `medication_id` | Dose logs in that period |

Arguments are validated before running. Results are truncated if large, and stored text such as notes is passed as data and never treated as instructions.

---

## 11. Permission matrix

| Caller | Read profile data | Write profile data |
|---|---|---|
| Owner | Yes | Yes |
| Caregiver, active link, `view` | Yes | No (`403`) |
| Caregiver, active link, `edit` | Yes | Yes |
| Caregiver, `pending`, `declined`, or `revoked` link | No (`403` / `404`) | No |
| Anyone else | No (`403` / `404`) | No |

Care links, notification settings, push subscriptions, and assistant conversations are always personal to their owner. A caregiver never gets access to them through a care link.

## 12. Implementation notes
- Build in this order: auth, care links plus `can_access_profile`, medications, schedules and doses, refills, appointments, notifications, then the assistant.
- Put business rules (refill math, due-dose calculation, reminders) in `services.py` modules and keep views thin.
- Write the authorization test for each endpoint before the endpoint itself.
- Generate an OpenAPI schema (for example with `drf-spectacular`) once the endpoints exist and use it to check that this document still matches the code.