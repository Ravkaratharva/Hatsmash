# Hatsmash

Hatsmash audits live AI-built websites for accessibility, performance, SEO, unfinished AI-builder output, and security basics. Every normalized issue includes a copy-paste fix prompt for Lovable, Cursor, Bolt, v0, and Replit Agent.

## Architecture

- `app/` is the Vinext/React frontend deployed through Sites.
- `services/scanner/` is the Node.js scanning service deployed as a Render Web Service.
- Upstash Redis backs both BullMQ scan jobs and the three-scans-per-IP daily quota.
- Supabase Postgres stores completed scans. Only the Render scanner opens the
  Postgres connection; the Cloudflare-hosted frontend never imports a TCP driver.
- `lib/scan-schema.ts` is the single shared Zod contract used by the frontend and scanner.

The scanner is separate because the Sites runtime cannot launch Chromium. The Render Web Service hosts the HTTP API and BullMQ worker in one process for the free/demo deployment. A paid production deployment should split the worker into its own always-on service.

## Local setup

Requirements: Node.js 22.13 or newer, the existing Upstash Redis database, and
the existing Supabase project `okhcheekqxtmdonrrudd` (`Hatsmash`). Do not create
a replacement project when the free project is paused.

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `.env.local`, replace the placeholder Redis URL, and run the two processes:

```bash
npm run scanner:build
npm run scanner:start
npm run dev
```

The site runs at `http://localhost:3000` and the scanner defaults to `http://localhost:8788`.

## Supabase database

There are two independent migration systems in this repository:

- `drizzle-postgres/` is the Supabase Postgres application schema and grants.
- `drizzle/` is Cloudflare D1 history for frontend authentication rate limiting.

Never run one folder against the other database. The current Supabase project
already has migration history and live tables; do not replay the initial
Postgres migration over it. Compare the live `supabase_migrations.schema_migrations`
history first, review the SQL, and apply only a missing migration as a named
Supabase migration.

For a new, empty recovery database only, the verified Drizzle command is:

```powershell
$env:DATABASE_MIGRATION_URL = "postgres://postgres.project-ref:password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require"
npm run db:migrate
Remove-Item Env:DATABASE_MIGRATION_URL
```

`DATABASE_MIGRATION_URL` is an owner connection used only by reviewed local
migration tooling. It must never be configured on Render or Sites. Runtime
`DATABASE_URL` is the least-privilege `hatsmash_scanner` connection and belongs
only on Render. Both use Supabase **Session Pooler**: the dashboard-provided host
ends in `pooler.supabase.com` and the port is `5432`. Do not construct this URL,
use the IPv6-only Direct endpoint, or substitute the port `6543` Transaction
pooler.

If the existing free Supabase project is paused, open project
`okhcheekqxtmdonrrudd` in the Supabase dashboard and choose **Restore project**.
Wait for `ACTIVE_HEALTHY`, then compare migration history, tables, grants, RLS,
and row counts before applying anything. Restoration is the safe recovery path;
do not reset the database or create a replacement project.

RLS is enabled on `profiles`, `scans`, and `captured_emails`. `anon` and
`authenticated` have no table privileges. The scanner role has only `INSERT` on
`scans` and `captured_emails`, with matching insert-only RLS policies. The
closed `profiles` table intentionally has no policy until account ownership is
implemented.

## Checks

```bash
npm test
npm run lint
npm run scanner:smoke
```

The smoke test audits the W3C Before and After accessibility demo pages and prints category-level result counts.

## Render deployment

`render.yaml` and `Dockerfile.scanner` define the existing free Render Web
Service. Do not create a replacement. Environment placement is:

| Name | Location | Purpose |
| --- | --- | --- |
| `REDIS_URL` | Render scanner | Upstash queue and quota |
| `DATABASE_URL` | Render scanner | Least-privilege Session Pooler runtime connection |
| `DATABASE_MIGRATION_URL` | Local/admin shell only | Owner connection for reviewed DDL |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Render now; Sites only when HTTPS client features need them | Supabase project/client configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only if a later scanner feature requires it | Never prefix with `VITE_` or import under `app/` |
| `SCANNER_SERVICE_URL` | Sites | Public HTTPS URL of the Render scanner |

`sync: false` in `render.yaml` only declares a secret name; it does not prove a
value exists. Verify the actual Render environment separately without revealing
the value. A correct runtime `DATABASE_URL` uses the Session Pooler hostname,
port `5432`, and the `hatsmash_scanner` database role.

Render probes `/healthz`, which checks only cheap queue liveness. `/readyz`
separately reports sanitized Redis, worker, and database readiness. Database
failure returns a `degraded` result while scans can still complete; persistence
emits a structured `scan_persistence` outcome tied to the scan ID.

After Render provides the service URL, set `SCANNER_SERVICE_URL` on the Sites
frontend and redeploy it privately.

Do not commit `.env.local`, Redis credentials, API keys, or generated scan output.

Passwordless account access requires the exact Supabase and Turnstile configuration in [docs/supabase-auth-setup.md](docs/supabase-auth-setup.md). Anonymous scans do not require an account.
