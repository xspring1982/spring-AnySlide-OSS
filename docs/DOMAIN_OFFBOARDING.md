# Domain Offboarding Checklist

Use this checklist when retiring a hosted AnySlide domain. It removes public
routing and webhooks without deleting database rows, stored files, payment
history, or provider accounts.

## Scope

Do:

- Remove the domain from the hosting platform project.
- Remove or disable DNS records that point the domain at the app.
- Disable provider webhooks that call the retired domain.
- Keep provider accounts and data intact until separately reviewed.

Do not:

- Delete databases.
- Delete object storage buckets.
- Delete payment records.
- Delete user accounts.
- Rotate secrets without a separate rotation plan.

## Hosting Platform

1. Open the hosting project settings.
2. Remove the custom domain from the project.
3. Confirm the default preview URL still works if you need a private smoke test.
4. Remove environment variables that only existed for the retired domain.
5. Disable automatic production deploys if the service should stay offline.

## DNS Provider

1. Open DNS settings for the domain.
2. Remove `A`, `AAAA`, or `CNAME` records that route the apex or `www` host to
   the app.
3. Keep MX/TXT records only if email must continue working.
4. Lower TTL before changes when possible.
5. Verify with:

```bash
dig A example.com
dig CNAME www.example.com
dig MX example.com
```

## Webhooks

Disable or update webhook endpoints that target the retired domain:

- Clerk webhook endpoint
- Stripe webhook endpoint
- Inngest endpoint or sync integration
- Email provider inbound or click-tracking callbacks
- Monitoring callbacks

## Verification

```bash
curl -I https://example.com
curl -I https://www.example.com
```

Expected result after DNS propagation: the retired domain should no longer serve
the AnySlide app. The exact response may be NXDOMAIN, a parking page, or a 404
from the new DNS target depending on how the domain is retired.
