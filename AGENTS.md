# AnySlide Contributor Notes

These notes are safe for public contributors and coding agents. They describe
repository conventions only; production credentials, hosted deployment runbooks,
customer data, and private operations are intentionally excluded.

## Project Summary

AnySlide is an open-source AI generation app for slides, knowledge cards, and
images. The app accepts text, links, and supported uploads, then uses async jobs
to analyze content, build outlines, assemble prompts, render HTML decks, and
export results.

## Source Of Truth

- `README.md` explains the public repository boundary.
- `SELF_HOSTING.md` explains local and production setup.
- `SPEC.md` gives the public architecture overview.
- `docs/DESIGN_SPEC.md` documents UI conventions.
- `.env.example` lists supported configuration keys without real secrets.

## Development Commands

```bash
npm install
npm run dev:all
npm run lint
npm run build
```

Local generation workflows need two processes: the Next.js dev server and the
Inngest dev server. `npm run dev:all` starts both.

## Editing Rules

- Keep changes minimal and focused.
- Do not commit `.env*` files except `.env.example`.
- Do not commit local uploads, generated task output, logs, build artifacts, or
  provider credentials.
- Prefer existing code style and module boundaries.
- Keep provider integrations configurable through environment variables.
- Treat billing, auth, and credit accounting as high-risk code; test focused
  behavior before shipping changes.

## Public Repository Boundaries

Do not add:

- Production provider account IDs, endpoint names, or secret values
- Customer/user data
- Private deployment checklists
- Internal handoff notes
- Real support inbox credentials
- Domain ownership or DNS operational details

When documenting examples, use `example.com`, `localhost`, or generic provider
placeholders.
