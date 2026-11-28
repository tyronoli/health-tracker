# CONTEXT.md: how this project works (read this first)

This file is for whoever helps build the project next: a new chat, a new tool, or you in six months.
It describes **how the code is organised and the rules it follows**. It does not say what is finished.
Progress lives in `TASK.md`. Requirements are in `docs/PRD.md` and `docs/SRS.md`. Endpoints are in `docs/API.md`.

**Update this file whenever a new rule or pattern is introduced.** Keep it short and specific.

## What this is
A personal health tracker: medications, doses, refills, appointments, reminders. A caregiver can have their own
login and, with consent, view (or edit) a family member's profile. It is a **practice project: fake data only**, and
it is a **tracker, not medical advice** (the app must never give dosing or medical advice).

## Stack
- Backend: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL (Docker), Celery + Redis + django-celery-beat.
  Session authentication with CSRF (no JWT). JSON only.
- Frontend: React + TypeScript + Vite, Tailwind CSS v4, TanStack Query v5, React Router (declarative mode, `react-router`).
- Tests: pytest, pytest-django, ruff, mypy (backend); Vitest, Testing Library, ESLint, `tsc` (frontend).
- Dev machine: Ubuntu (one machine runs it through WSL). One `.env` in the repo root, never committed.

## Layout
```
backend/config/            settings, urls, celery.py
backend/apps/core/         shared: exceptions, pagination, timeutils, testing helpers
backend/apps/accounts/     User (email login, timezone), NotificationSettings, auth endpoints
backend/apps/care/         CareLink (caregiver -> recipient), permission helpers, profiles endpoint
backend/apps/medications/  Medication, Schedule, DoseLog; scheduling.py, doses.py, refills.py
backend/apps/appointments/ Appointment
backend/apps/reminders/    DoseReminder, services.py (emails), tasks.py (Celery)
frontend/src/{api,components,context,hooks,lib,pages,theme,test}
```

## Backend rules
1. **Business logic goes in service modules** (`services.py`, `scheduling.py`, `doses.py`, `refills.py`), not in views or serializers.
2. **Authorization goes through `apps/care/permissions.py` only.** Never write your own check.
   - `can_access_profile(user, target, write=False)`: owner always; a caregiver only through an `active` CareLink; `edit` needed for writes. One-directional.
   - `get_target_profile(user, profile_id, write=False)`: for `?profile=` and a `profile` body field. No access (or unknown id) gives 403, a malformed id gives 400.
   - `check_object_access(user, owner, write=False)`: for a single object. Not visible at all gives 404, visible but read-only gives 403.
3. **Viewsets override `get_object()`**: missing and forbidden objects return the *same* `NotFound()`, so existence never leaks. `get_queryset()` is only for list endpoints. `create()` checks access *before* validating the body. The owner of a new object comes from the profile, never from a request field.
4. **Every endpoint has tests** proving another user is denied. Data endpoints use the caregiver matrix in `apps/core/testing.py` (`prepare`, `matrix`): six link states (no link, pending, declined, revoked, active view, active edit) against each action, with the expected status codes.
5. **Errors have one shape**: `{"error": {"code", "message", "fields"?}}` (`apps/core/exceptions.py`). Anonymous requests get 401. Conflicts use the `Conflict` exception (409) with a code such as `already_logged`.
6. **Pagination**: `DefaultPagination` (page_size 20, `page_size` up to 100). Small nested lists are plain arrays.
7. **Times**: store UTC; each user has an IANA `timezone`. Use `apps/core/timeutils.py` (`owner_zone`, `local_midnight`, `parse_date_param`). Date filters (`from`, `to`) are inclusive local dates in the **data owner's** timezone, not the caller's. API datetimes must carry an offset (naive ones are rejected).
8. **Tests freeze time through a seam**: `scheduling.current_time()` (medications, reminders) and `appointments.services.current_time()`. Always call them as `module.current_time()` so monkeypatching works.
9. **Fixtures** (in `backend/conftest.py`): `make_user`, `alex` (caregiver), `mum` (recipient), `stranger`, `make_link`, `client_for(user)`, `make_medication`, `make_schedule`, `make_dose_log`. App-specific ones live in each app's `tests/conftest.py`.
10. Check before every commit: `pytest`, `ruff format .`, `ruff check .`, `mypy .` (from `backend/`).

## Domain rules worth knowing
- **Doses are calculated, not stored.** `scheduling.due_doses_for_date(owner, local_date)` derives them from `Schedule` rows (`time_of_day` is the owner's local wall-clock time; weekdays Monday=0). A `DoseLog` row exists only once a dose is taken, skipped, or marked missed. Unique per (schedule, scheduled_for).
- `Schedule.tracking_started_at`: doses before it are never auto-marked missed. It resets when timing changes.
- Missed doses: `doses.mark_missed_doses` runs every 5 minutes (Celery). The grace period is per user (`NotificationSettings.missed_dose_grace_minutes`, default 60). Editing or deleting a schedule first records what was missed under the old rules.
- Refills: taking a dose deducts `pills_per_dose` (never below 0) and stores `pills_used` on the log; undoing returns exactly that. `Medication.low_supply_alert_raised_at` is set on a downward crossing of the threshold and cleared when back above (`refills.next_alert_state`).
- Medications are soft-deleted (`active=false`). Appointments are really deleted; "cancelled" is a status.
- Reminders: `DoseReminder` (unique per dose) records that an email was sent. Sending first claims the row with an atomic update, so two workers never both send. Failures release the claim. Logs contain user ids only, never emails or medication names.

## Frontend rules
1. All HTTP goes through `src/api/client.ts` (`api()`): CSRF header, JSON, and errors as `ApiError` (`status`, `code`, `message`, `fields`). Use `fieldError(error, 'name')` to show field errors under inputs.
2. Server data uses TanStack Query hooks (`src/hooks`). After a change, invalidate the affected query keys (`['medications']`, `['today']`, `['doses']`, `['appointments']`, `['care-links']`, `['profiles']`).
3. **Whose data**: `useProfiles()` gives `selected`, `canWrite`, `canWriteTo(ownerId)`. View-only profiles must show no write controls. Times are shown and typed in the **viewed person's** timezone (`selected.timezone`), never the browser's.
4. **Styling uses design tokens only** (`bg-paper`, `text-ink`, `bg-accent`, `border-line`, status colours `taken|missed|low|skipped|info`), defined as CSS variables in `src/index.css`. No raw colours in components. Dark mode and accents only change the variables. `src/theme/contrast.test.ts` checks WCAG contrast for every mode and accent.
5. Shared components: `Button`, `Card`, `StatusTag`, `TextField`, `SelectField`, `FilterChip`, `QueryError`, `ProfileSwitcher`, `ProfileNote`, `FloatingAddLink`.
6. Test helpers: `src/test/mockApi.ts` (routes keyed like `"GET /api/profiles/"`, including the query string), `renderPage` (all providers), `fixtures.ts`. Fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`). Vitest blanks CSS imports, jsdom has no `matchMedia` (stubbed in `setup.ts`).
7. Check before every commit (from `frontend/`): `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

## Workflow
- One task at a time from `TASK.md`: write the tests first, make them pass, commit, then tick the box.
- One branch per task (`v1-7b-...`), merged by pull request.
- Update `docs/API.md` and this file when behaviour or conventions change.
- Fake data only. Never commit `.env`, `.venv`, `node_modules`, or real personal data.