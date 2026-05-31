# AnySlide Public Architecture

This file is a public, implementation-oriented overview. It intentionally omits
private deployment history, production provider details, customer data, and
commercial operating notes.

## Product Modules

AnySlide contains three generation modes:

| Mode | Input | Output | Workflow |
|---|---|---|---|
| Slides | Text, links, PDF/PPTX where supported | HTML slide deck, exports | Analyze -> outline -> render/refine |
| Cards | Text and reference material | Knowledge-card image set | Analyze -> outline -> prompt assembly -> render |
| Image | Text prompt and optional references | Image output | Optional prompt enhancement -> generation |

## Core Flow

1. User creates a task.
2. API validates auth, credits, input, and selected mode.
3. Inngest receives the async generation job.
4. Text agents analyze or refine the source material.
5. Prompt/template assembly produces generation instructions.
6. Image or HTML rendering produces task files.
7. Task status and files are stored for the UI to stream or poll.

## Shared Infrastructure

- **App**: Next.js App Router and React.
- **Auth**: Clerk, with webhook-based user creation.
- **Database**: Postgres via Neon-compatible serverless driver.
- **Storage**: local filesystem for development, S3-compatible storage for production.
- **Async jobs**: Inngest.
- **Payments**: optional Stripe checkout, portal, and webhook handlers.
- **Email**: optional Resend integration.
- **AI providers**: configurable Anthropic-compatible text API and OpenAI-compatible image API.

## Credits And Billing

Credits are stored in Postgres and updated through transactional helpers. Paid
billing is optional. If Stripe is not configured, billing endpoints return
service-unavailable responses and the rest of the app can still be developed
locally.

Self-hosters must create their own Stripe products, prices, webhook endpoint,
and provider credentials.

## Storage

Development defaults to `STORAGE_BACKEND=local` and writes under `LOCAL_STORAGE_DIR`.
Production deployments should use an S3-compatible backend and short-lived signed
URLs for generated files.

## Security Principles

- Never commit real `.env` files.
- Keep all provider credentials server-side.
- Verify Stripe and Clerk webhooks with signing secrets.
- Keep generated user files private unless explicitly shared by the app.
- Treat uploaded files as untrusted input.
- Rotate credentials if they are ever exposed in a public repository or log.

## Configuration

Use `.env.example` as the authoritative list of supported environment variables.
`SELF_HOSTING.md` explains how to configure local and production environments.
