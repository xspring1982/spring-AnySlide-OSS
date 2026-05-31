# Security Policy

## Reporting Vulnerabilities

Please report security issues privately through the repository owner's preferred
private channel. Do not open a public issue for exploitable vulnerabilities,
credential leaks, payment bypasses, data exposure, or authentication bugs.

Include:

- Affected component or route
- Reproduction steps
- Expected and actual behavior
- Impact assessment
- Any relevant logs with secrets removed

## Secrets

Never commit real credentials. This includes:

- `.env*` files except `.env.example`
- API keys
- Webhook signing secrets
- Database URLs
- Storage credentials
- Payment provider keys
- Private certificates

If a secret is exposed, rotate it at the provider immediately. Removing it from
the latest commit is not enough if it has been pushed to a public repository.

## Supported Security Model

AnySlide is a self-hostable application. Operators are responsible for:

- Their own provider accounts
- Their own domains and DNS
- Their own customer data
- Their own secrets management
- Their own payment compliance
- Their own backups and retention policies
