# Public Roadmap

This roadmap tracks open-source improvements only. Private launch notes,
production incidents, customer support items, and provider-specific operations
are not stored in the public repository.

## Short-Term

- [ ] Improve self-hosting docs with provider-specific examples that use dummy values.
- [ ] Add focused tests for billing webhook idempotency.
- [ ] Add focused tests for credit deduction/refund behavior.
- [ ] Add a storage adapter smoke test that runs without real cloud credentials.
- [ ] Add a documented local seed path for demo templates.
- [ ] Reduce provider-specific comments in runtime code.

## Medium-Term

- [ ] Add a Docker-based local development profile.
- [ ] Add CI for lint, typecheck, and build.
- [ ] Add optional Sentry/PostHog setup docs.
- [ ] Add clearer sample data for contributors.
- [ ] Document supported file upload limits and parsing behavior.

## Long-Term

- [ ] Improve PPTX export fidelity.
- [ ] Expand test coverage around async task state transitions.
- [ ] Add contributor-friendly architecture diagrams.
- [ ] Add adapter examples for additional OpenAI-compatible image providers.
