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

Requirements: Node.js 22.13 or newer, an Upstash Redis database, and a Supabase project.

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

Set `DATABASE_URL` to the Supabase **Session Pooler** connection string: its host
ends in `pooler.supabase.com` and it uses port `5432`. The scanner is a persistent
IPv4 Render process, so do not use the IPv6-only Direct endpoint or the port
`6543` Transaction pooler.

After reviewing the SQL in `drizzle-postgres/`, apply the committed migration to Supabase:

```powershell
$env:DATABASE_URL = "postgres://postgres.project-ref:password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require"
npm run db:migrate
```

The migration enables RLS on all three public tables without adding public
policies. Scanner writes use the server-side Postgres connection; no table is
opened to anonymous Data API access in this task.

## Checks

```bash
npm test
npm run lint
npm run scanner:smoke
```

The smoke test audits the W3C Before and After accessibility demo pages and prints category-level result counts.

## Render deployment

`render.yaml` and `Dockerfile.scanner` define the free Render Web Service. During creation, set `REDIS_URL` to the full Upstash `rediss://` TCP connection and `DATABASE_URL` to the Supabase Session Pooler URL. After Render provides the service URL, set `SCANNER_SERVICE_URL` on the Sites frontend and redeploy it.

Do not commit `.env.local`, Redis credentials, API keys, or generated scan output.

Passwordless account access requires the exact Supabase and Turnstile configuration in [docs/supabase-auth-setup.md](docs/supabase-auth-setup.md). Anonymous scans do not require an account.
