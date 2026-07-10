---
name: PostgreSQL migration patterns
description: Key patterns used when migrating Elton Garage API from SQLite (better-sqlite3) to PostgreSQL (pg Pool).
---

## Core db helper (db.ts)
- Uses `pg.Pool` with `connectionString: process.env.DATABASE_URL`
- Exports `FullDb` type with async `get/all/run/exec/transaction`
- `transaction` takes `async (tx: DbMethods) => Promise<T>` callback; wraps in BEGIN/ROLLBACK/COMMIT
- `initDb()` is async; called in `index.ts` BEFORE `app.listen()`

## SQL conversion rules
| SQLite | PostgreSQL |
|--------|-----------|
| `?` params | `$1, $2, …` (sequential per query) |
| `LIKE` | `ILIKE` |
| `INSERT OR IGNORE` | `INSERT … ON CONFLICT DO NOTHING` |
| `MAX(0, x)` | `GREATEST(0, x)` |
| `datetime('now')` | `new Date().toISOString()` |
| `date('now')` | `new Date().toISOString().split('T')[0]` |
| `result.lastInsertRowid` | `RETURNING id` + `result.id` |
| `SQLITE_CONSTRAINT_UNIQUE` | pg error code `'23505'` |
| `IN (${placeholders})` batch | `= ANY($1::int[])` |

## Admin credentials
- Email: `admin@eltongarage.com`, password: `admin123`
- Seeded by `initDb()` if no admin exists

## pg package resolution
- `pg` is available via `@workspace/db` transitive dependency even without explicit declaration in api-server package.json
- Still declare it explicitly in api-server/package.json to avoid fragility
- `@types/pg` not in pnpm store; use local `src/types/pg.d.ts` declaration or install properly

**Why:** Autoscale deployment wipes SQLite file on every redeploy; PostgreSQL persists.
