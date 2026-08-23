# Hatsmash Supabase Auth setup

The code uses Supabase Auth for passwordless, six-digit email OTPs. Hatsmash does not store passwords or application user records in this authentication slice. Sessions are handled on the server with HTTP-only cookies.

## 1. Create a dedicated project

Create a new Supabase project named `Hatsmash`. Do not reuse an unrelated project. Use the current publishable key (`sb_publishable_...`), not a service-role or secret key.

## 2. Configure email OTP

In Supabase **Authentication → Email Templates → Magic Link**, replace the link-based template with a code template that contains `{{ .Token }}`. Keep email confirmation enabled. Both Log In and Sign Up intentionally use the same verified email-code flow, and a first successful verification creates the account.

Use a production SMTP provider before inviting public users. Supabase's default mail service is appropriate only for limited development testing and has restrictive delivery limits.

## 3. Restrict redirect URLs

Set the Site URL to exactly:

```text
https://hatsmash-audit.ravkaratharva01.chatgpt.site
```

If the dashboard requires redirect entries, allow only these exact values:

```text
https://hatsmash-audit.ravkaratharva01.chatgpt.site/account
http://localhost:3000/account
http://127.0.0.1:3000/account
```

Do not add wildcards. The current OTP implementation does not place auth data in callback URLs; these entries exist only for explicitly approved future PKCE callback use.

## 4. Enable Turnstile in Supabase

Create a Cloudflare Turnstile widget restricted to the exact production hostname and local development hostnames. In **Supabase Authentication → Bot and Abuse Protection**, enable Turnstile and store the Turnstile secret there. The secret does not belong in Hatsmash environment variables.

## 5. Set private runtime variables

Set these as private Sites runtime variables, never as `NEXT_PUBLIC_...` values:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
TURNSTILE_SITE_KEY=...
AUTH_RATE_LIMIT_SALT=at-least-32-random-characters
```

No service-role key is required. The app refuses authentication requests when configuration or durable rate limiting is unavailable.

## 6. Apply the Cloudflare D1 migration

Apply `drizzle/0000_auth_rate_limits.sql` through the Sites deployment flow. The table contains only HMAC-hashed abuse-control keys and counters; it never contains raw IP addresses, email addresses, OTPs, tokens, or user profiles.

## Future user-owned data

No `profiles` or other Supabase application table is created in this slice. Before adding saved scans, reports, billing records, GitHub connections, or monitoring settings, enable RLS and use ownership policies equivalent to:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

Add a matching `SELECT` policy where updates need row visibility. `TO authenticated` alone is not authorization, and service-role credentials must remain server-only.
