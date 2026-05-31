# Self-Hosting AnySlide

This guide explains how to run AnySlide with your own infrastructure and
provider accounts.

## Requirements

- Node.js compatible with Next.js 16
- npm
- Postgres database
- Clerk application
- Inngest account or local Inngest dev server
- AI provider credentials
- Optional: S3-compatible object storage
- Optional: Stripe account for paid billing
- Optional: Resend account for emails

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev:all
```

Open <http://localhost:3000>.

`npm run dev:all` starts both:

- Next.js on port 3000
- Inngest dev server connected to `/api/inngest`

## Environment Variables

Use `.env.example` as the complete template. Keep real values in `.env.local`,
hosting-provider environment variables, or a secrets manager.

Do not commit:

- `.env`
- `.env.local`
- `.env.production`
- Provider import/export files
- Secret backups

## Database

Set `DATABASE_URL` to a Postgres connection string. Then run:

```bash
npm run db:migrate
```

Review migration files under `db/migrations` before running them against a
production database.

## Storage

For local development:

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_DIR=./tmp
```

For production, configure an S3-compatible bucket:

```env
STORAGE_BACKEND=r2
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=
```

You can replace the R2-compatible settings with another S3-compatible provider
if its endpoint and credentials work with the storage adapter.

## AI Providers

Text generation uses `ANYSLIDE_TEXT_*` variables for Anthropic-compatible APIs.
Image generation uses `OPENAI_API_KEY` and optional `OPENAI_BASE_URL` for
OpenAI-compatible image APIs.

Use your own provider credentials. The repository does not include hosted
service keys.

## Billing

Stripe billing is optional. If you enable it:

1. Create your own Stripe products and prices.
2. Set the `STRIPE_PRICE_*` variables.
3. Create a webhook endpoint at `/api/webhooks/stripe`.
4. Configure `STRIPE_WEBHOOK_SECRET`.
5. Test checkout and webhook idempotency before accepting real payments.

Leave Stripe variables empty for non-commercial local development.

## Auth Webhooks

Create a Clerk webhook endpoint at `/api/clerk/webhook` and set
`CLERK_WEBHOOK_SECRET`.

## Production Deployment

Any hosting platform that supports Next.js can be used. At minimum:

1. Set all required environment variables in the hosting platform.
2. Run database migrations intentionally.
3. Configure object storage.
4. Configure Clerk and Stripe webhook URLs for your deployment domain.
5. Enable HTTPS.
6. Run `npm run build`.

Production domains, DNS, and provider accounts are owned by the self-hoster.
This repository does not grant access to any hosted AnySlide service.
