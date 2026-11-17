# PRD: Health Tracker

**Status:** Draft v1.1 | **Last updated:** 2026-11-17
**Related docs:** `SRS.md` (detailed requirements), `API.md` (endpoints), `architecture.md` (design), `../TASK.md` (build plan)

---

## 1. Overview

Health Tracker is a web app (installable as a PWA, works in a phone browser) that helps a person take medications on time, know when a refill is needed, and keep track of medical appointments. A caregiver can have their own login and, with the family member's consent, view that person's profile.

Version 1 is a reliable tracker with reminders. Version 2 adds an AI assistant you can chat with about your own schedule.

This is a **practice project** built with fake data. It is a tracker, not a medical device, and it never gives medical advice.

## 2. Problem

- People forget doses, or can't remember whether they already took one.
- Refills run out unexpectedly because nobody counts pills.
- Appointment details live in scattered places (paper, texts, calendars).
- Caregivers helping a family member have no shared, consent-based view of what has been taken.

## 3. Goals and non-goals

### Goals
1. Make it easy to log each dose in one tap and see today's doses at a glance.
2. Send timely reminders by email and push notification.
3. Warn before medication supply runs out.
4. Keep appointments organized with upcoming-appointment reminders.
5. Let a caregiver view a family member's profile only with that person's explicit, revocable consent.
6. (V2) Let a user ask questions about their own data in plain language.

### Non-goals
- Medical advice, diagnosis, dose recommendations, or drug-interaction checking
- Pharmacy, clinic, or insurance integrations
- Native iOS/Android apps
- Team or organization features (roles, group chat). Several caregivers per person are possible through separate links, but there are no group features.
- Real patient data. The project is for learning and uses fake data.

## 4. Users and personas

| Persona | Description | Key needs |
|---|---|---|
| **Patient** | Manages their own medications and appointments | Fast dose logging, reliable reminders, low-supply warnings |
| **Caregiver** | Helps a family member; has their own login | See whether doses were taken, see appointments, optionally help edit; never see data without consent |
| **Care recipient** | A patient who has granted a caregiver access | Control: accept, limit to view-only, and revoke at any time |

A care recipient is simply a patient who has linked a caregiver.

## 5. Scope by version

| Area | V1 | V2 | Later |
|---|---|---|---|
| Accounts, timezone, sessions | Yes | | |
| Care links (invite, accept, revoke, view/edit) | Yes | | |
| Medications, schedules | Yes | | |
| Dose log (taken, skipped, missed) | Yes | | |
| Refill tracking and low-supply alerts | Yes | | |
| Appointments (list, calendar) | Yes | | |
| Email and web push reminders | Yes | | |
| Notification settings | Yes | | |
| Data export, account deletion | Yes (Should) | | |
| AI chat assistant (read-only tools) | | Yes | |
| Retrieval over appointment notes | | Optional | |
| Assistant write actions with confirmation | | | Yes |
| Caregiver alert when a dose is missed | | | Yes |
| Medication photo/label scanning | | | Yes |

## 6. Features

Priority: **Must** / **Should** / **Could**.

### 6.1 Accounts (V1)
- Register with email and password, log in, log out (Must)
- Set timezone; all times display in the user's timezone (Must)
- Change password; password reset by email (Should)
- Delete account and all data (Should)

### 6.2 Care circle (V1)
- Caregiver invites a family member by email, requesting `view` or `edit` access (Must)
- Recipient accepts or declines; can change the permission level or revoke at any time (Must)
- Profile switcher: choose whose data you are viewing (Must)
- Every data screen shows clearly whose profile is being viewed (Should)

### 6.3 Medications (V1)
- Add, edit, and deactivate medications: name, dosage, instructions, pills remaining, refill threshold (Must)
- Deactivating keeps the history (Must)

### 6.4 Schedules and dose log (V1)
- One or more schedules per medication: times of day, days of the week, start and end dates, pills per dose (Must)
- "Today" screen listing each due dose with Taken and Skip buttons (Must)
- Doses with no action become Missed after a grace period (Must)
- History with filters by date, medication, and status (Must)
- Log an extra or as-needed dose that has no schedule (Should)
- Adherence summary, e.g. "taken 92% over the last 30 days" (Could)

### 6.5 Refills (V1)
- Pill count decreases when a dose is logged as Taken (Must)
- "Days of supply left" estimate from the schedule (Must)
- Low-supply indicator and email alert once when the threshold is crossed (Must)
- "I refilled" action to add pills (Must)

### 6.6 Appointments (V1)
- Add, edit, delete: title, provider, location, date and time, notes (Must)
- Upcoming list and month calendar (Must)
- Reminder before the appointment (Must)

### 6.7 Reminders and notifications (V1)
- Email reminder for each due dose (Must)
- Browser/phone push notification for each due dose (Must)
- Appointment and low-supply reminders (Must)
- Settings: turn email and push on or off, appointment reminder lead time, missed-dose grace period (Should)
- Install as a PWA for push on phones (Must). iPhone push works only after installing to the home screen.

### 6.8 Privacy and safety (V1 and V2)
- Authorization on every endpoint; users see only their own data or data shared through an active care link (Must)
- A visible "tracker only, not medical advice" notice (Must)
- Fake data only in development (Must)

### 6.9 AI assistant (V2)
- Chat UI with streaming replies (Must)
- Read-only tools: upcoming appointments, today's doses, low-supply medications, dose history (Must)
- Assistant respects the same permissions as the rest of the app (Must)
- Declines medical, dosing, and medication-change advice and suggests a doctor or pharmacist (Must)
- Conversation list, delete a conversation, delete all (Must)
- Rate limits and a daily token budget (Must)
- Retrieval over appointment notes (Could)

## 7. Key user stories and acceptance criteria

| ID | Story | Acceptance criteria |
|---|---|---|
| US-1 | As a patient, I register and set my timezone so reminders arrive at the right local time. | Registration succeeds with valid email and password; timezone is saved; invalid input shows field errors. |
| US-2 | As a patient, I add a medication with a schedule. | The medication appears in my list; its doses appear on the Today screen on scheduled days. |
| US-3 | As a patient, I tap Taken on a due dose. | The dose is saved as taken with a timestamp; pill count drops by pills-per-dose; logging the same dose twice is rejected. |
| US-4 | As a patient, I receive a push notification at the dose time and can open the app from it. | Exactly one notification per due dose, within one minute of the scheduled time. |
| US-5 | As a patient, I'm told when I'm running low. | One email and an indicator appear when supply falls to the threshold or below; no repeats until refilled. |
| US-6 | As a patient, I add an appointment and get a reminder. | The appointment shows at the right local time; a reminder is sent at the configured lead time. |
| US-7 | As a caregiver, I invite my parent to share their profile. | A pending link is created; nothing is visible to me until they accept. |
| US-8 | As a care recipient, I accept an invite as view-only. | The caregiver can read my medications, doses, and appointments but every write attempt is rejected. |
| US-9 | As a care recipient, I revoke access. | The caregiver immediately loses access to all of my data. |
| US-10 | As a caregiver, I switch to my family member's profile and see today's doses. | The Today screen shows their doses, clearly labeled with their name. |
| US-11 | As a user, I can never see another user's data. | Automated tests prove 403/404 for every endpoint when the caller has no link. |
| US-12 | (V2) As a user, I ask "What appointments do I have this week?" | The assistant answers using the appointments tool for my profile only. |
| US-13 | (V2) As a user, I ask the assistant whether I should double a missed dose. | The assistant declines to give dosing advice and suggests asking a doctor or pharmacist. |
| US-14 | (V2) As a user, I delete a conversation. | The conversation and its messages are permanently removed. |

## 8. Key flows

**First-time setup:** register, set timezone, add a medication, add its schedule, enable notifications, optionally install the PWA.

**Daily dose:** reminder arrives, open Today, tap Taken, supply count updates. If ignored, the dose becomes Missed after the grace period.

**Linking a caregiver:** caregiver enters the family member's email and requested access, recipient gets an email and an in-app invite, recipient accepts (optionally choosing view-only), caregiver can then switch to that profile.

**Revoking access:** recipient opens the care circle page and clicks Revoke; the link becomes revoked and access ends immediately.

**Refill:** doses are logged, supply drops below the threshold, one email alert is sent, the user picks up the refill and taps "I refilled".

**Assistant (V2):** open chat, ask a question, the assistant calls read-only tools for the active profile, streams an answer, and declines anything that is medical advice.

## 9. Success metrics

This is a practice project, so success is mostly engineering quality.

| Metric | Target |
|---|---|
| Reminder timeliness | 99% of reminders sent within 60 seconds of scheduled time in local testing |
| Authorization | 100% of endpoints have a passing "another user is denied" test |
| Reminder duplicates | Zero duplicate reminders across a daylight-saving change in tests |
| Reliability of logging | Dose logged once and only once, even on double taps |
| Learning | V1 and V2 shipped with all `Done when` criteria in `TASK.md` met |
| Assistant safety (V2) | 100% pass on the permission and medical-advice categories of the eval set |

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Authorization bug leaks one user's data to another | Single permission helper, per-endpoint tests, audit in V1-8 |
| Reminders fire late, twice, or at the wrong local time | Store UTC, idempotent reminder markers, timezone and DST tests |
| iPhone push does not work in a normal browser tab | Document it; PWA install flow; email as fallback |
| Users treat the app as medical advice | Visible notice; assistant refuses dosing advice; no interaction checking |
| Assistant leaks or is manipulated by stored text | Tools take the user from the server; stored notes treated as data; eval set includes injection and cross-user cases |
| Real health data enters a practice system | Fake data only; seed command; clear warnings in README |
| Scope creep | Version scoping in section 5; "Later" list |

## 11. Assumptions and open questions

**Assumptions**
- Users have a modern browser; reminders use the browser's push support.
- Email is delivered through a standard provider; locally it prints to the console.
- A care recipient can have more than one caregiver link.

**Open questions**
1. Should a recipient be able to give a caregiver view access to only some data (e.g. appointments but not medications)? Default for V1: all or nothing.
2. Assistant provider: hosted API, local model, or both? (Decide in V2-0.)
3. Chat retention period and what is sent to a hosted model. (Decide in V2-7.)
4. Do you want caregiver alerts for missed doses sooner than "Later"?

## 12. Release plan

| Release | Contents | Build plan |
|---|---|---|
| **v1.0** | Core tracker, reminders, hardening | `TASK.md` V1-0 to V1-8 |
| **v1.1** (optional) | Deployment | `TASK.md` V1-9 |
| **v2.0** | AI assistant, read-only | `TASK.md` V2-0 to V2-9 |
| **Later** | Retrieval, write actions, caregiver alerts | `TASK.md` V2-10 and ideas list |