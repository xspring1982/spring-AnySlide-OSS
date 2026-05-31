# AnySlide

AnySlide is an open-source AI slide, knowledge-card, and image generation app.
It combines a Next.js product UI with async generation workflows, template-driven
slide rendering, credit accounting, and optional billing.

The public repository is intended for self-hosting, study, and contribution.
Hosted deployments, production credentials, customer data, payment accounts, and
domain operations are not included.

## Features

- AI slide generation from text, links, and uploaded files
- AI image generation with prompt enhancement
- Knowledge-card generation workflow
- Template gallery and HTML/PPTX-oriented slide rendering
- Clerk authentication integration
- Neon Postgres persistence
- Local filesystem or S3-compatible object storage
- Inngest async jobs
- Optional Stripe billing and credit accounting
- Multilingual UI scaffolding

## Tech Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS v4
- Clerk
- Neon Postgres
- Inngest
- Stripe
- OpenAI-compatible image generation API
- Anthropic-compatible text generation API
- Cloudflare R2 or another S3-compatible storage provider

## License

This project is licensed under the GNU Affero General Public License v3.0.
See [LICENSE](./LICENSE).

If you deploy a modified version as a network service, AGPL-3.0 requires that
users can access the corresponding source code for that deployed version.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev:all
```

Open <http://localhost:3000>.

For full configuration, see [SELF_HOSTING.md](./SELF_HOSTING.md).

## Public Repository Boundary

This repository contains source code and public documentation only. It does not
include:

- Production secrets or environment files
- Hosted service credentials
- Database snapshots or customer data
- Payment account data
- Domain or DNS ownership
- Private deployment runbooks

Use your own provider accounts and credentials when self-hosting.

## Documentation

- [SELF_HOSTING.md](./SELF_HOSTING.md) — local and production setup
- [SECURITY.md](./SECURITY.md) — vulnerability reporting and secret handling
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution workflow
- [docs/DOMAIN_OFFBOARDING.md](./docs/DOMAIN_OFFBOARDING.md) — retire a hosted domain without deleting data
- [docs/PUBLICATION_CHECKLIST.md](./docs/PUBLICATION_CHECKLIST.md) — safe public-release checklist
- [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) — bundled third-party assets
- [docs/DESIGN_SPEC.md](./docs/DESIGN_SPEC.md) — public UI notes
- [SPEC.md](./SPEC.md) — public architecture overview

## Development

```bash
npm run lint
npm run build
```

Generation jobs need both the Next.js app and Inngest dev server locally. Use
`npm run dev:all` for the combined local workflow.
