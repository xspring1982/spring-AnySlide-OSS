# Public Release Checklist

Use this checklist before making a repository public.

## Required

- [ ] Current tree contains no real `.env*` files.
- [ ] Current tree contains no customer data, local uploads, internal handoffs, or private deployment notes.
- [ ] High-confidence secret scan returns no matches.
- [ ] `npm run build` passes.
- [ ] License file exists and `package.json` declares the same license.
- [ ] Public README explains the self-hosting boundary.
- [ ] Security policy explains private vulnerability reporting.

## Git History

Do not make an existing private repository public if earlier commits contain
private docs, secrets, customer data, or production runbooks.

Choose one release path:

1. Create a new public repository from a clean source snapshot.
2. Rewrite the existing repository history, delete old remote branches/tags that
   still reference private objects, then make it public.

The first path is safer and easier to audit. The second path is disruptive and
requires explicit coordination with anyone who has cloned the private repo.

## After Publication

- Enable GitHub secret scanning and push protection.
- Add branch protection for the default branch.
- Confirm issues and discussions settings.
- Confirm the default branch builds in CI.
- Rotate any credentials that were ever present in a private commit history
  before publication.
