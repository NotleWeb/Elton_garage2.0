---
name: Multi-service appointments schema
description: Many-to-many between appointments and services; key pitfalls and decisions.
---

## Decision
`appointments.service_id` was removed. A junction table `appointment_services(id, appointment_id FK CASCADE, service_id FK, UNIQUE(appointment_id, service_id))` now holds the relationship.

## Migration pitfall
`PRAGMA foreign_keys = OFF` must be called **outside** any active transaction. `db.transaction()` in better-sqlite3 starts an implicit BEGIN, so the pragma is silently ignored inside it. The `runMigrations()` function calls the pragma directly on `db` before any steps, uses try/finally to restore `foreign_keys = ON`.

**Why:** SQLite docs: "This pragma is a no-op between BEGIN and COMMIT." Setting it inside `db.transaction()` callback caused SqliteError SQLITE_CONSTRAINT_FOREIGNKEY when dropping the old appointments table.

**How to apply:** Any future DDL that needs FK constraints disabled must call `db.pragma("foreign_keys = OFF")` before creating a transaction, not inside one.

## Startup order
`runMigrations()` is called **before** `initDb()` in app.ts. On fresh DBs, `runMigrations` is a no-op (no service_id column). On legacy DBs, it migrates before `initDb` creates/seeds.

## Validation rule
Both POST and PUT for appointments must check `serviceRows.length === ids.length` after querying services by the submitted IDs. Invalid IDs must return 400; never silently drop them.

## Reports parameterization
`/reports/services` builds `aptWhere` and `params` using a shared builder. The `totalRevenue` sub-query must reuse the same `aptWhere`/`params` — never build a separate hardcoded `>= ?` query that doesn't mirror the filter construction.

## customers.ts /:id/appointments
This route was still joining on `a.service_id` after the schema change. It now batch-loads services via `appointment_services` (same pattern as `loadServicesMap` in appointments.ts).
