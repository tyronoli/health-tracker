# API.md: Health Tracker REST API

**Status:** v1.2, matches the backend as of V1-7a | **Last updated:** 2026-11-28
Base path: `/api/` | Format: JSON (UTF-8) | Version tags: **V1** core, **V2** assistant (planned)
Related docs: `SRS.md`, `PRD.md`, `architecture.md`, `CONTEXT.md`

Endpoints marked **Planned** are in the roadmap but not built yet. Everything else in sections 3 to 9 exists in the code and is covered by tests.

---

## 1. Conventions

### 1.1 Authentication and CSRF
- Session cookie authentication. The browser sends the cookie automatically (same origin; the Vite dev server proxies `/api` to Django).
- Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) need the CSRF token in the `X-CSRFToken` header. Get the cookie with `GET /api/auth/csrf/`. A missing or wrong token returns `403 permission_denied` ("CSRF check failed.").
- **Public** endpoints need no login. Everything else returns `401 not_authenticated` when not logged in.
- Only JSON is accepted and returned. A malformed body returns `400 parse_error`, a wrong content type `415 unsupported_media_type`.

### 1.2 Whose data? The `profile` parameter
Data endpoints work on one person's profile at a time.
- **Lists and reads of a collection:** `?profile=<user_id>`. Defaults to the current user.
- **Creating medications and appointments:** `profile` field in the JSON body. Defaults to the current user.
- **Everything addressed by id** (`/medications/7/`, `/schedules/11/`, `/doses/301/`, `/appointments/21/`) takes no `profile`. The owner is looked up from the object itself.
- **Doses and schedules** never read `profile` from the body. The owner comes from the schedule or medication.

Access is decided by `can_access_profile(request_user, target_user, write)` in `apps/care/permissions.py`: the owner always; a caregiver only through an `active` care link, with `edit` needed for writes. Access is one-directional.

Failure codes differ by endpoint type (full table in section 10):

| Situation | Status |
|---|---|
| `?profile=` or body `profile` is not a number | `400` |
| `?profile=` unknown, or caller has no access, or `write` needed and link is `view` | `403` |
| Object id cannot be seen by the caller (missing and forbidden look identical) | `404` |
| Object is visible but the caller only has `view` and tried to write | `403` |

### 1.3 Formats
| Type | Format | Example |
|---|---|---|
| Datetime (response) | ISO 8601 in UTC with `Z` | `2026-11-18T00:00:00Z` |
| Datetime (request, appointments) | ISO 8601 **with an offset**. A time without one is rejected | `2026-11-26T09:30:00+08:00` |
| Datetime (request, `POST /doses/`) | ISO 8601, send an offset. One without is read as UTC | `2026-11-17T00:00:00Z` |
| Date | `YYYY-MM-DD` | `2026-11-18` |
| Time of day | `HH:MM` in the owner's timezone (`HH:MM:SS` is accepted, seconds dropped) | `08:00` |
| Days of week | integers 0 to 6, Monday = 0 | `[0,1,2,3,4]` |
| Timezone | IANA name, validated | `Asia/Manila` |
| IDs | integers | `12` |

### 1.4 Pagination
List endpoints marked *paginated* accept `page` (default 1) and `page_size` (default 20, max 100):
```json
{ "count": 57, "next": "http://localhost:5173/api/doses/?page=2", "previous": null, "results": [] }
```
`next` and `previous` are absolute URLs. Lists marked *plain array* (schedules of a medication, low-supply) are not paginated.

### 1.5 Errors
All errors from the API use one shape:
```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields are invalid.",
    "fields": { "pills_remaining": ["Must be 0 or greater."] }
  }
}
```
`fields` appears only on validation errors that name fields. Errors that apply to the whole request appear under `non_field_errors`.

| Status | Meaning | `code` |
|---|---|---|
| 400 | Invalid input | `validation_error`, `invalid_credentials`, `parse_error` |
| 401 | Not logged in | `not_authenticated` |
| 403 | Logged in but not allowed, or CSRF failure | `permission_denied` |
| 404 | Not found or not visible to you | `not_found` |
| 405 | Method not allowed | `method_not_allowed` |
| 409 | Conflict with current state | `already_logged`, `link_exists`, `invalid_state` |
| 415 | Not JSON | `unsupported_media_type` |

Known gaps (V1-8): unknown `/api/` routes and unhandled server errors return Django's HTML pages, not this shape. There is no rate limiting yet, so `429 rate_limited` is never returned.

---

## 2. Endpoint index

| # | Method | Path | Purpose |
|---|---|---|---|
| **Auth and account** | | | |
| 1 | GET | `/api/auth/csrf/` | Set CSRF cookie (Public) |
| 2 | POST | `/api/auth/register/` | Create account (Public) |
| 3 | POST | `/api/auth/login/` | Log in (Public) |
| 4 | POST | `/api/auth/logout/` | Log out |
| 5 | GET | `/api/auth/me/` | Current user |
| 6 | PATCH | `/api/auth/me/` | Update name, timezone |
| **Care circle** | | | |
| 7 | GET | `/api/profiles/` | Profiles I can open |
| 8 | GET | `/api/care-links/` | My care links (paginated) |
| 9 | POST | `/api/care-links/` | Invite a recipient |
| 10 | PATCH | `/api/care-links/{id}/` | Change permission (recipient) |
| 11 | POST | `/api/care-links/{id}/accept/` | Accept invite |
| 12 | POST | `/api/care-links/{id}/decline/` | Decline invite |
| 13 | POST | `/api/care-links/{id}/revoke/` | End a link |
| **Medications and schedules** | | | |
| 14 | GET | `/api/medications/` | List medications (paginated) |
| 15 | POST | `/api/medications/` | Create medication |
| 16 | GET | `/api/medications/{id}/` | Get medication |
| 17 | PATCH | `/api/medications/{id}/` | Update medication |
| 18 | DELETE | `/api/medications/{id}/` | Stop (deactivate) medication |
| 19 | POST | `/api/medications/{id}/refill/` | Record a refill |
| 20 | GET | `/api/medications/{id}/schedules/` | List schedules (plain array) |
| 21 | POST | `/api/medications/{id}/schedules/` | Create schedule |
| 22 | PATCH | `/api/schedules/{id}/` | Update schedule |
| 23 | DELETE | `/api/schedules/{id}/` | Delete schedule |
| **Doses and refills** | | | |
| 24 | GET | `/api/doses/today/` | Today's doses |
| 25 | GET | `/api/doses/` | Dose history (paginated) |
| 26 | POST | `/api/doses/` | Log a dose |
| 27 | PATCH | `/api/doses/{id}/` | Correct a logged dose |
| 28 | GET | `/api/refills/low-supply/` | Low-supply medications (plain array) |
| **Appointments** | | | |
| 29 | GET | `/api/appointments/` | List appointments (paginated) |
| 30 | POST | `/api/appointments/` | Create appointment |
| 31 | GET | `/api/appointments/{id}/` | Get appointment |
| 32 | PATCH | `/api/appointments/{id}/` | Update appointment |
| 33 | DELETE | `/api/appointments/{id}/` | Delete appointment |
| **Notifications** | | | |
| 34 | GET | `/api/notification-settings/` | Get my settings |
| 35 | PATCH | `/api/notification-settings/` | Update my settings |

Not built yet: see section 11.

---

## 3. Auth and account

### GET `/api/auth/csrf/` (Public)
Sets the `csrftoken` cookie. `204 No Content`. The frontend calls it automatically before the first unsafe request.

### POST `/api/auth/register/` (Public)
```json
{ "email": "alex@example.com", "password": "S0me-long-password", "display_name": "Alex", "timezone": "Asia/Manila" }
```
`201` with the user, and the user is logged in:
```json
{ "id": 1, "email": "alex@example.com", "display_name": "Alex", "timezone": "Asia/Manila" }
```
- `email` is stored lowercase.
- `timezone` must be a real IANA name (default `UTC`). `display_name` is optional.
- The password goes through Django's validators (length, common, numeric, similarity to the email or name).
- Errors `400 validation_error`: bad email, weak password (`fields.password`, a list of messages), unknown timezone (`fields.timezone`). An already-registered email (case-insensitive) returns a deliberately vague `fields.non_field_errors: ["Could not create the account."]`.

### POST `/api/auth/login/` (Public)
```json
{ "email": "alex@example.com", "password": "S0me-long-password" }
```
`200` with the user object. Sets the session cookie. Email is case-insensitive.
Error `400 invalid_credentials` ("Invalid email or password.") for a wrong password, unknown email and inactive account alike.

### POST `/api/auth/logout/`
`204`. Ends the session. `401` if not logged in.

### GET `/api/auth/me/`
`200` with the user object above.

### PATCH `/api/auth/me/`
Body: any of `display_name`, `timezone`. `200` with the updated user. `email` and `id` are read only and silently ignored. `400` for an unknown timezone. `PUT` is not allowed.

---

## 4. Care circle

### GET `/api/profiles/`
Profiles the current user may open: themselves first, then recipients of **active** links where the user is the caregiver (sorted by name, then email). Not paginated.
```json
[
  { "user_id": 1, "display_name": "Alex", "relationship": "self", "permission": "edit", "timezone": "Asia/Manila" },
  { "user_id": 2, "display_name": "Mum", "relationship": "recipient", "permission": "view", "timezone": "Europe/London" }
]
```
`display_name` falls back to the email when empty. `timezone` is each person's own timezone, used to show their times. Used by the profile switcher.

### Care link object
```json
{
  "id": 5,
  "caregiver": { "id": 1, "display_name": "Alex", "email": "alex@example.com" },
  "recipient": { "id": 2, "display_name": "Mum", "email": "mum@example.com" },
  "permission": "view",
  "status": "pending",
  "created_at": "2026-11-17T08:00:00Z",
  "responded_at": null
}
```
`permission`: `view` or `edit`. `status`: `pending`, `active`, `declined`, `revoked`.
Every care-link endpoint is scoped to links where the caller is the caregiver or the recipient. Any other link id returns `404`.

### GET `/api/care-links/`
Paginated, newest first. Query: `role=caregiver|recipient` (optional), `status=pending|active|declined|revoked` (optional). `400` for any other value.

### POST `/api/care-links/`
Caregiver invites a recipient.
```json
{ "email": "mum@example.com", "permission": "view" }
```
`permission` defaults to `view`. `201`:
```json
{ "message": "If an account exists for that email, an invitation has been sent." }
```
The `201` is identical whether or not the account exists, and nothing is created for an unknown email. If the account exists, a `pending` link is created. (No invitation email is sent yet; planned in V1-7b.)

Errors: `400` for an invalid email or permission, `400` with `fields.email: ["You cannot link to yourself."]`, `409 link_exists` when a `pending` or `active` link to that person already exists. After a `declined` or `revoked` link, a new invitation is allowed.

### PATCH `/api/care-links/{id}/`
Recipient only. Body: `{ "permission": "view" }` (or `edit`). `200` with the link. Errors: `403` for the caregiver, `409 invalid_state` unless the link is `active`, `400` for a bad value.

### POST `/api/care-links/{id}/accept/`
Recipient only, `pending` links only. Optional body `{ "permission": "view" }` to accept with a level equal to or lower than requested. `200` with the link, status `active`, `responded_at` set. Errors: `403` for the caregiver, `409 invalid_state` if not pending, `400` (`fields.permission`) when asking for more than was requested.

### POST `/api/care-links/{id}/decline/`
Recipient only, `pending` only. `200` with the link, status `declined`. Errors: `403`, `409 invalid_state`.

### POST `/api/care-links/{id}/revoke/`
Caregiver or recipient. Works on `pending` (cancels a request) and `active` links. `200` with the link, status `revoked`. Access ends immediately. Error: `409 invalid_state` for a `declined` or `revoked` link.

---

## 5. Medications and schedules

All collection endpoints accept `profile` (section 1.2). Medications are never hard-deleted.

### Medication object
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
  "low_supply": false,
  "days_supply_left": 12,
  "schedules": [
    { "id": 11, "medication": 7, "time_of_day": "08:00", "days_of_week": [0,1,2,3,4,5,6],
      "start_date": "2026-11-17", "end_date": null, "pills_per_dose": 1, "active": true }
  ],
  "created_at": "2026-11-01T02:00:00Z",
  "updated_at": "2026-11-17T01:30:00Z"
}
```
Read only: `id`, `owner`, `low_supply` (pills at or below the threshold), `days_supply_left`, `schedules`, `created_at`, `updated_at`. `schedules` includes paused ones, ordered by time. `days_supply_left` is whole days at the current weekly rate, `null` if the medication is stopped or has no usable schedule.

### GET `/api/medications/`
Paginated, sorted by name. Query: `profile`, `active=true|false` (`400` otherwise), `page`, `page_size`.

### POST `/api/medications/`
```json
{ "profile": 1, "name": "Metformin", "dosage": "500 mg", "instructions": "Take with food", "pills_remaining": 30, "refill_threshold": 10 }
```
`201` with the medication. Only `name` is required (not blank, max 200). `dosage` max 100. `pills_remaining` and `refill_threshold` are integers 0 to 100000 (default 0). Access to `profile` is checked before the body: `403` without an `edit` link. Creating a medication that is already low does not raise an alert.

### GET `/api/medications/{id}/`
`200` or `404`.

### PATCH `/api/medications/{id}/`
Any of `name`, `dosage`, `instructions`, `pills_remaining`, `refill_threshold`, `active`. `200` with the medication. Editing stock or threshold can raise or clear the low-supply marker. `owner` in the body is ignored. `PUT` returns `405`. `403` for a view-only caregiver.

### DELETE `/api/medications/{id}/`
Soft delete: sets `active=false` and keeps schedules and history. `204`. Restart with `PATCH {"active": true}`.

### POST `/api/medications/{id}/refill/`
`{ "pills_added": 30 }` (integer 1 to 10000). `200` with the medication. Clears the low-supply marker if stock is back above the threshold. `400` (`fields.pills_added`) if the value is invalid or the total would exceed 100000.

### Schedule object
```json
{
  "id": 11, "medication": 7, "time_of_day": "08:00", "days_of_week": [0,1,2,3,4,5,6],
  "start_date": "2026-11-17", "end_date": null, "pills_per_dose": 1, "active": true
}
```

### GET `/api/medications/{id}/schedules/`
Plain array, ordered by time. Works for stopped medications too.

### POST `/api/medications/{id}/schedules/`
Body: `time_of_day`, `days_of_week`, `start_date` (all required), optional `end_date`, `pills_per_dose` (1 to 100, default 1), `active` (default true). `201` with the schedule. The medication comes from the URL, never the body.
Rules: `days_of_week` is a non-empty list of 0 to 6 (duplicates removed, sorted). `end_date` must not be before `start_date`. Tracking starts now, so doses before the schedule existed are never marked missed.

### PATCH `/api/schedules/{id}/`
Any schedule field except `medication`. `200`. Before the change, doses that were already missed under the old rules are recorded. Changing the time, days, start date or end date, or re-activating a paused schedule, restarts tracking. Changing only `pills_per_dose` or pausing does not. `end_date` is checked against the stored `start_date`.

### DELETE `/api/schedules/{id}/`
`204`. Missed doses are recorded first. Existing dose logs are kept (their `schedule` becomes `null`).

There is no `GET /api/schedules/{id}/`. Schedules are read through their medication.

---

## 6. Doses and refills

Doses are **calculated** from schedules. A dose log row exists only once a dose is taken, skipped or marked missed.

### Dose log object
```json
{
  "id": 301, "medication": 7, "schedule": 11,
  "scheduled_for": "2026-11-17T00:00:00Z", "status": "taken",
  "logged_at": "2026-11-17T00:03:12Z", "note": ""
}
```
`schedule` is `null` after its schedule was deleted.

### GET `/api/doses/today/`
Query: `profile`. Doses due today in the **profile owner's** timezone, each with its current state.
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
      "logged_at": "2026-11-17T00:03:12Z",
      "pills_per_dose": 1
    },
    {
      "schedule": 12,
      "medication": { "id": 7, "name": "Metformin", "dosage": "500 mg" },
      "scheduled_for": "2026-11-17T12:00:00Z",
      "status": "pending",
      "dose_log_id": null,
      "logged_at": null,
      "pills_per_dose": 1
    }
  ]
}
```
Sorted by time, then medication name. `status` is `pending`, `taken`, `skipped` or `missed`. An unlogged dose shows as `missed` once the owner's grace period has passed (default 60 minutes, see notification settings), unless it is from before the schedule's tracking started. `dose_log_id` and `logged_at` are `null` until a log exists. A `missed` dose with a `dose_log_id` was recorded by the background job.

### GET `/api/doses/`
Dose history, newest first, paginated. Query: `profile`, `from` and `to` (dates, inclusive, in the **owner's** timezone), `medication` (id), `status` (`taken|skipped|missed`), `page`, `page_size`. `400` for a bad date, number or status.

### POST `/api/doses/`
Log a dose.
```json
{ "schedule": 11, "scheduled_for": "2026-11-17T00:00:00Z", "status": "taken", "note": "", "medication": 7 }
```
`201` with the dose log. `status` is `taken` or `skipped` (`missed` is set only by the system). `note` is optional, max 500. `medication` is optional and must match the schedule's medication. `profile` is ignored: the owner comes from the schedule.

Effects: `taken` deducts `pills_per_dose` (never below 0), remembers how many were really deducted, and may raise the low-supply marker. `skipped` leaves stock alone. The whole request is atomic.

Errors:
- `400 validation_error`: `scheduled_for` does not exactly match a dose of the schedule (wrong time, day, outside start and end dates), more than 24 hours in the future (`fields.scheduled_for`), schedule or medication not active, medication mismatch, bad status, note too long.
- `404`: schedule missing or not visible. `403`: visible but the link is `view` only.
- `409 already_logged`: that schedule and time already has a log (including a system-made `missed` one; correct it with `PATCH` instead).

### PATCH `/api/doses/{id}/`
Correct a mistake: `{ "status": "skipped", "note": "felt sick" }`. Both fields optional. `200` with the dose log.
- `taken` to `skipped` gives back exactly the pills that were deducted. `skipped` or `missed` to `taken` deducts again (nothing if the schedule was deleted).
- Changing the status updates `logged_at`. Editing only the note does not.
- `status` must be `taken` or `skipped`; `missed` returns `400`.
- There is no way to remove a log. `DELETE` and `GET /api/doses/{id}/` are not available.

### GET `/api/refills/low-supply/`
Query: `profile`. Plain array of **active** medications at or below their threshold, fewest pills first, each in the medication object format (with `days_supply_left`).

---

## 7. Appointments

### Appointment object
```json
{
  "id": 21,
  "owner": 1,
  "title": "Chest X-ray",
  "type": "imaging",
  "provider_name": "St. Luke's Imaging",
  "location": "Level 2",
  "starts_at": "2026-11-26T01:30:00Z",
  "duration_minutes": 30,
  "preparation": "Wear loose clothing",
  "notes": "Bring the referral",
  "status": "scheduled",
  "created_at": "2026-11-17T01:00:00Z",
  "updated_at": "2026-11-17T01:30:00Z"
}
```
`type`: `checkup` (default `other`), `consultation`, `imaging`, `lab_test`, `procedure`, `other`.
`status`: `scheduled` (default), `completed`, `cancelled`. `preparation` is what the clinic told the user, stored as written (the app gives no medical advice).
Read only: `id`, `owner`, `created_at`, `updated_at`.

### GET `/api/appointments/`
Paginated. Query:

| Param | Meaning |
|---|---|
| `profile` | whose appointments |
| `from`, `to` | dates, inclusive, in the **owner's** timezone |
| `type`, `status` | exact match; `400` for unknown values |
| `upcoming=true` | `starts_at >= now` **and** `status=scheduled`, soonest first |
| `upcoming=false` | already started (`starts_at < now`), any status, newest first |

Without `upcoming` the order is soonest first. Any other `upcoming` value returns `400`. The month calendar uses `from` and `to`.

### POST `/api/appointments/`
Body: `title` and `starts_at` required; optional `profile`, `type`, `provider_name` (max 200), `location` (max 200), `duration_minutes` (1 to 1440 or `null`), `preparation` (max 2000), `notes` (max 5000), `status`. `title` is not blank, max 200.
`starts_at` **must include an offset**. A time like `2026-11-26T09:30:00` returns `400` with a message explaining the fix. Past appointments may be recorded. `201`. `owner` in the body is ignored. Access to `profile` is checked first (`403` without `edit`).

### GET `/api/appointments/{id}/`
`200`, or `404` if missing or not visible.

### PATCH `/api/appointments/{id}/`
Any writable field, including `status` and `duration_minutes: null`. `200`. `PUT` returns `405`. `403` for a view-only caregiver.

### DELETE `/api/appointments/{id}/`
Really deletes the row. `204`. To keep a record, set `status` to `cancelled` instead.

---

## 8. Notifications

### GET `/api/notification-settings/`
Always the current user's own settings. A user who never changed anything gets the defaults.
```json
{ "email_enabled": true, "push_enabled": true, "appointment_reminder_minutes": 1440, "missed_dose_grace_minutes": 60 }
```

### PATCH `/api/notification-settings/`
Any of the four fields. `200` with the settings.
- `appointment_reminder_minutes`: 5 to 10080 (7 days).
- `missed_dose_grace_minutes`: 5 to 720 (12 hours). Used for the missed-dose job and for the `missed` status on Today.
- `email_enabled`, `push_enabled`: booleans.
- `400` for anything else. `PUT`, `POST`, `DELETE` return `405`.

Settings are personal. A caregiver cannot see or change a recipient's settings.

---

## 9. Background jobs (no HTTP)

Celery beat runs these. They have no endpoints.

| Task | Every | What it does |
|---|---|---|
| `reminders.tasks.send_dose_reminders` | 60 s | Emails each owner whose dose time passed within the last 30 minutes and is not logged. One email per owner per run, at most once per dose (`DoseReminder` row, claimed atomically, released if sending fails). Respects `email_enabled`. Goes to the owner only. |
| `reminders.tasks.mark_missed_doses` | 300 s | Writes `missed` logs for unlogged doses past the owner's grace period (looks back 3 days). Safe to repeat. Also available as `python manage.py mark_missed_doses [--lookback-days N]`. |

In development, emails print in the Celery worker terminal.

---

## 10. Permission matrix

`alex` is the caregiver, `mum` the recipient. Status codes seen when alex calls an endpoint for mum's data, by link state:

| Action | no link / pending / declined / revoked | active `view` | active `edit` |
|---|---|---|---|
| List with `?profile=` (medications, appointments, today, history, low-supply) | 403 | 200 | 200 |
| Get one object (medication, appointment) | 404 | 200 | 200 |
| List a medication's schedules | 404 | 200 | 200 |
| Create with `profile` in body (medication, appointment) | 403 | 403 | 201 |
| Create a schedule under mum's medication | 404 | 403 | 201 |
| Log a dose on mum's schedule | 404 | 403 | 201 |
| Patch or delete an object, correct a dose, refill | 404 | 403 | 200 / 204 |

Other rules:
- A caller with no link gets the same `404` for a real object and a missing one.
- An unknown `?profile=` id behaves like a profile with no access (`403`).
- Access is one-directional: if alex cares for mum, mum gets nothing of alex's.
- Care links, notification settings and (later) push subscriptions and assistant conversations are personal. A caregiver never reaches them through a care link.
- A link stops granting access the moment it is `declined` or `revoked`.

---

## 11. Not built yet

| Planned | Task |
|---|---|
| `GET /api/health/` health check | V1-8 |
| `DELETE /api/auth/me/` (delete account), `POST /api/auth/password/change/`, password reset (`/api/auth/password/reset/` and `/confirm/`), `GET /api/export/` | V1-8 |
| Rate limiting and `429 rate_limited` | V1-8 |
| JSON `404` and `500` for unknown `/api/` routes | V1-8 |
| Web push: `GET /api/push/vapid-public-key/`, `POST /api/push/subscriptions/`, `DELETE /api/push/subscriptions/{id}/`, `POST /api/push/test/` | V1-7c |
| `GET /api/doses/adherence/` (parked), as-needed doses without a schedule (parked) | later |
| Assistant endpoints (section 12) | V2 |

Email reminders for appointments, low supply and invitations are tracked in V1-7b. They add no endpoints.

---

## 12. Assistant (Version 2, planned)

Not implemented. Design for reference. Every endpoint works only on the caller's own conversations (`404` otherwise). The assistant is read-only and cannot change data.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/assistant/conversations/` | List my conversations (paginated, newest first) |
| POST | `/api/assistant/conversations/` | Start one. Body `{ "profile": 1 }` (optional). The profile is fixed on the server and checked with `can_access_profile` |
| GET | `/api/assistant/conversations/{id}/` | Conversation with its `messages` |
| DELETE | `/api/assistant/conversations/{id}/` | Delete one, with its messages |
| DELETE | `/api/assistant/conversations/` | Delete all of mine |
| POST | `/api/assistant/conversations/{id}/messages/` | Send `{ "content": "..." }`, stream the reply |

The message endpoint returns `text/event-stream` with the events `message_start`, `tool_call`, `tool_result`, `token`, `message_end`, and `error` (`{"code", "message"}`). Use `fetch` with a `ReadableStream`, since `EventSource` cannot POST. Abort the request to stop a reply.

The model can call only four server-side tools, and each takes the user and profile from the conversation, never from its own arguments: `list_upcoming_appointments(days_ahead 1-60)`, `get_todays_doses()`, `list_low_supply_medications()`, `get_dose_history(days 1-30, medication_id?)`. Stored text such as notes is treated as data, never as instructions.

---

## 13. Implementation notes
- Business rules live in `services.py`, `scheduling.py`, `doses.py` and `refills.py`. Views stay thin.
- Every viewset overrides `get_object()` so missing and forbidden objects return the same `404`. `create()` checks access before validating the body.
- Write the "another user is denied" test for each endpoint before the endpoint.
- Once the endpoints settle, generate an OpenAPI schema (for example with `drf-spectacular`) and check this document against it.