# SAPIO Deployment

Vercel imports the repository root (`/`) and deploys from the `main` branch.

## Runtime
- Static SAPIO web client from the repository root
- Serverless endpoints under `/api`
- One consolidated collection endpoint at `/api/collect`

## Scheduler
SAPIO intentionally uses no fleet of scheduled tasks.

On Vercel Hobby, native Cron is limited to once per day, so `vercel.json` contains one daily bootstrap call to `/api/collect` at `0 6 * * *` (06:00 UTC). Do not change this back to `*/15 * * * *` on Hobby; Vercel rejects the deployment before creating a normal deployment record.

The target architecture is one daily bootstrap plus an application-managed durable 15-minute collection loop. Until that internal loop is enabled, `/api/collect` can also be invoked manually with the configured bearer secret.

## Environment
Secrets must be configured only in Vercel environment variables. Do not commit live values. See `.env.example` for variable names.

## Production checks
1. `/` renders the SAPIO age gate and timeline.
2. `/api/feed` returns JSON.
3. `/api/collect` executes without uncaught errors.
4. The Vercel project shows the single daily cron definition from `vercel.json`.
5. Production is linked to `georgealex55/Sapio` on branch `main`.

## Git integration
A successful Vercel status on a `main` commit confirms the GitHub-to-Vercel deployment hook is active.
