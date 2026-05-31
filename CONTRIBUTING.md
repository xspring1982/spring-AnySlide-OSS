# Contributing

Thanks for contributing to AnySlide.

## Workflow

1. Fork or branch from `dev`.
2. Keep the change focused.
3. Add or update tests when behavior changes.
4. Run the relevant checks:

```bash
npm run lint
npm run build
```

5. Open a pull request with a clear summary and test plan.

## Code Guidelines

- Keep provider credentials in environment variables.
- Avoid hardcoded deployment domains.
- Keep billing and credit changes small and well tested.
- Prefer existing module boundaries over broad refactors.
- Do not commit generated output, local uploads, logs, or build artifacts.

## Documentation Guidelines

Public docs should use placeholders such as `example.com`, `localhost`, and
dummy provider values. Do not document private production incidents, account
IDs, customer records, or secret rotation details.
