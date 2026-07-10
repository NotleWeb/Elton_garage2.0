---
name: Firebase Firestore Migration
description: Full rewrite of Elton Garage API server from PostgreSQL to Firebase Firestore — patterns, secrets, and deployment requirements.
---

## What changed
- `artifacts/api-server/src/db.ts` — replaces `pg.Pool` with Firebase Admin SDK + Firestore helpers
- All 18 route files rewritten (no SQL, no pg/drizzle anywhere)
- `package.json` — removed `pg`, `@types/pg`, `multer`, `drizzle-orm`, `@workspace/db`; added `firebase-admin ^13.4.0`

## Key patterns

### Auto-increment IDs
Firestore has no sequences. Use `_counters` collection:
```ts
export async function nextId(collection: string): Promise<number>
```
Document IDs are the string representation of the integer: `"1"`, `"2"`, etc.
All helpers (`getById`, `getAll`, `createDoc`, etc.) normalise `id` back to a `number`.

### Joins → parallel reads + merge in memory
No SQL JOINs. Fetch parent collections in parallel with `Promise.all`, build Maps, merge.

### Atomic multi-doc writes → `db.batch()`
`db.batch()` is used whenever two or more documents must be written together:
- inventory movement + stock update
- product usage + stock update + movement record
- appointment service list replacement
- appointment deletion (cascades to services, order_services, product_usage)

### Appointment completion → `db.runTransaction()`
Financial transaction creation + customer totals update are done inside a Firestore transaction for atomicity.

### Auth secret
Both `auth.ts` (signing) and `middleware/auth.ts` (verification) use `process.env.SESSION_SECRET`.
No fallback — the server throws at startup if it is missing.

## Required environment variables for production (Render.com)

| Variable | Description |
|---|---|
| `SESSION_SECRET` | JWT signing key (already in Replit secrets) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON of Firebase service account key |
| `PORT` | Set automatically by Render |

## How to get FIREBASE_SERVICE_ACCOUNT_JSON
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key" → download JSON
3. On Render: paste the entire JSON as the value of `FIREBASE_SERVICE_ACCOUNT_JSON`
4. On Replit (dev): add it as a secret named `FIREBASE_SERVICE_ACCOUNT_JSON`

## Backup
`GET /api/backup` now exports ALL Firestore collections as a single JSON file (not SQL dump).

## Build notes
- `firebase-admin` is in `build.mjs` `external[]` list (line 69) — NOT bundled, loaded from node_modules at runtime
- TypeScript compiles cleanly: `pnpm --filter @workspace/api-server run typecheck` exits 0
- Build: `pnpm --filter @workspace/api-server run build` → 1.7 MB dist/index.mjs

**Why:** User does not want Replit deployment; entire stack (Netlify + Render) is self-hosted outside Replit. Firebase Spark free tier fits the garage use case. PostgreSQL was hosted on Neon which requires a paid plan for always-on connections.
