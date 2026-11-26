---
name: Notification System Design
description: Automated notification and follow-up system for Elton Garage — architecture decisions, deduplication strategy, scheduler pattern.
---

## Architecture

### Service layer
- `artifacts/api-server/src/services/notification.service.ts` — pure business logic
- `artifacts/api-server/src/services/scheduler.service.ts` — background job runner

### Scheduler
- Uses `setInterval` (no external cron library needed)
- Runs once at startup (5s delay) + every hour
- Two jobs: `generateMissingFollowUps` + `generateMissingAppointmentReminders`

## Notification Data Model (Firestore `notifications` collection)

Fields beyond the original schema:
- `appointment_id` — links to the triggering appointment
- `subtype` — deduplication key: `appointment_reminder | feedback_1d | maintenance_15d | return_30d`
- `scheduled_for` — ISO string; null = immediate; GET endpoint filters `<= now`
- `read_at`, `completed`, `completed_at`, `archived` — action states

## Deduplication Strategy

### Appointment reminders (per-appointment)
- One check: `where("appointment_id", ==, id).where("subtype", ==, "appointment_reminder")`
- If exists → skip. Simple dedup since each appointment has a unique reminder.

### Follow-up reminders (per-customer, upsert)
- Business rule: "always use the LATEST completed appointment per customer"
- Implementation: **upsert** — query `where("customer_id", ==, id).where("subtype", ==, X).where("read", ==, 0)`, update `scheduled_for`/`appointment_id`/`message` if found, create if not
- This means completing a new appointment automatically refreshes pending follow-ups

**Why:** Creating per-appointment follow-ups would generate parallel sequences for customers with multiple completions. Upsert ensures only the latest completion drives the reminder dates.

## Scheduler Backfill Logic
- `generateMissingFollowUps`: groups completed appointments by customer → keeps only the latest per customer → checks each subtype (`feedback_1d`, `maintenance_15d`, `return_30d`) independently with batch queries → calls `scheduleFollowUpReminders` only for missing subtypes
- `generateMissingAppointmentReminders`: checks appointments due in the next 48h with `agendado/em_andamento` status → calls `scheduleAppointmentReminder` (dedup handled inside)

## Notification Center UI (Notificacoes.tsx)
- Read filter tabs: Todas / Não lidas / Lidas
- Type filter dropdown with all 8 notification types
- Action buttons per card: mark read (✓), mark complete (✓✓), archive, delete
- Relative timestamps via `date-fns/formatDistanceToNow`

## API Client Extensions (appended to generated api.ts)
- `useDeleteNotification` — DELETE /api/notifications/:id
- `useCompleteNotification` — PATCH /api/notifications/:id/complete
- `useArchiveNotification` — PATCH /api/notifications/:id/archive

**Important:** After editing `lib/api-client-react/src/generated/api.ts`, must rebuild declarations:
`pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
Otherwise the frontend typecheck will fail (it uses `dist/` declarations via project references).

## New Routes on /api/notifications
- `GET /` — extended filters: read, type, customerId, dateFrom, dateTo; excludes archived + future-scheduled
- `PATCH /read-all` — marks all due non-archived unread as read
- `PATCH /:id/read` — mark single as read
- `PATCH /:id/complete` — mark completed + read
- `PATCH /:id/archive` — archive + read
- `DELETE /:id` — hard delete
