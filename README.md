# A-Bags Handmade

Production-oriented e-commerce application for **a_bags.handmade**, a Polish handmade handbag brand.

**Live storefront:** https://abagshandmade.pl  
**Primary deployment target:** Cloudflare Workers

> The application uses a fail-closed go-live model: checkout remains blocked until required seller, tax, product-safety, packaging, privacy and transactional-email configuration is explicitly completed and confirmed.

## Product scope

A-Bags Handmade combines a public storefront with an owner-only management panel and a Cloudflare-native backend.

Core capabilities include:

- responsive storefront for handmade bags;
- persistent cart and checkout flow;
- Stripe Checkout with card/BLIK payment selection;
- fixed delivery pricing and optional owner-configured local pickup;
- Stripe webhook processing and order persistence;
- transactional order-confirmation e-mails;
- product management with image upload to R2;
- review submission, moderation and rate limiting;
- editable storefront content;
- order fulfilment management with carrier/tracking data;
- Polish consumer/legal information pages;
- privacy-consent handling with server fallback for restricted Android WebViews;
- protected owner/admin surfaces;
- production-readiness dashboard;
- PWA metadata for standalone mobile use.

## Architecture

```text
Browser / installed PWA
        │
        ▼
Cloudflare Worker
        │
        ├── Vinext / React application
        ├── Cloudflare Access → owner routes
        ├── D1 → products, reviews, orders, settings
        ├── R2 → product media
        ├── Stripe → checkout + BLIK/cards + webhook
        └── Resend → transactional order e-mail
```

### Runtime stack

- **React 19**
- **Next.js 16 application model** compiled through **Vinext / Vite**
- **TypeScript**
- **Cloudflare Workers**
- **Cloudflare D1**
- **Cloudflare R2**
- **Stripe**
- **Drizzle ORM / Drizzle Kit**
- **GitHub Actions** for build verification and production deployment

## Repository structure

```text
app/                       storefront, legal pages, owner panel, API routes
lib/                       catalog, products, orders, reviews, Stripe and legal config
worker/                    Cloudflare Worker entry point and security/access layer
scripts/                   deterministic build, artifact validation and deploy patching
tests/                     regression and production-hardening tests
public/                    PWA manifest, brand icon and public assets
.github/workflows/         CI and Cloudflare deployment workflows
LEGAL-COMPLIANCE-PL-2026.md
```

## Production security model

The Worker is the outer security boundary for production traffic.

Implemented controls include:

- Cloudflare Access gate for `/panel`, `/site-admin` and `/api/admin/*`;
- application-level admin e-mail allowlist checks;
- checkout fail-closed when legal readiness is incomplete;
- server-side Stripe amount/product validation;
- signed Stripe webhook verification;
- public review rate limiting using a SHA-256 client fingerprint rather than persisting raw IP addresses;
- CSP with optional Instagram sources enabled only after consent;
- `Strict-Transport-Security`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: SAMEORIGIN`;
- restricted `Permissions-Policy`;
- HTML `Cache-Control: no-store` plus `Vary: Cookie` where consent affects rendered content/security policy;
- image type validation from file bytes rather than trusting browser MIME metadata.

## Owner panel

The protected owner dashboard includes five areas:

1. **Status sklepu** — D1, R2, Stripe, webhook, transactional e-mail and legal go-live blockers.
2. **Treść strony** — editable storefront content.
3. **Produkty** — catalog, visibility, pricing and media.
4. **Opinie** — moderation workflow.
5. **Zamówienia** — payment/fulfilment status, tracking and pickup settings.

The readiness screen exposes only Boolean configuration states; secret values are never returned to the browser.

## Payments and orders

Checkout is created server-side. Product IDs and quantities are validated against the current visible catalog before Stripe line items are generated.

Supported payment presentation includes:

- card payments;
- BLIK;
- Stripe-supported wallet options when available to the customer/device.

A successful Stripe webhook persists/updates the order and triggers the durable order-confirmation e-mail path. Checkout remains unavailable when the production legal/configuration gate reports unresolved blockers.

## Polish legal-compliance layer

The repository contains implementation support for the Polish/EU e-commerce compliance workstream, including:

- `/regulamin`
- `/polityka-prywatnosci`
- `/cookies`
- `/zwroty-i-reklamacje`
- `/bezpieczenstwo-produktow`

`LEGAL-COMPLIANCE-PL-2026.md` and the go-live issue track obligations that cannot be truthfully proven by code alone, such as the seller's actual business/VAT status, GPSR documentation, BDO/packaging obligations and privacy/vendor records.

The source code intentionally does **not** invent or auto-confirm those facts.

## Privacy and mobile compatibility

The consent flow is designed to remain usable when React hydration, JavaScript storage or vendor Android WebViews behave differently from desktop Chrome.

Key properties:

- initial server-rendered consent form;
- native POST fallback for the privacy choice;
- cookie-backed server-visible consent;
- defensive `localStorage` access;
- immediate banner dismissal after selection;
- optional Instagram content blocked until consent;
- regression coverage for restricted Android WebView behaviour.

The PWA manifest uses a standalone presentation with `/` as the application ID/scope and the a_bags brand icon.

## Accessibility

Current hardening includes:

- semantic dialogs where applicable;
- keyboard focus trap inside active modals;
- initial focus management;
- focus restoration after modal close;
- accessible labels/ARIA state on interactive storefront controls;
- responsive mobile layout.

Accessibility is treated as an ongoing QA gate rather than a one-time certification claim.

## Development

Requirements:

- Node.js `>=22.13.0`
- npm
- Linux/CI environment for the full build helper scripts

Install dependencies:

```bash
npm install
```

Run development mode:

```bash
npm run dev
```

Run the production build plus regression tests:

```bash
npm test
```

Validate an already generated deployment artifact:

```bash
npm run validate:artifact
```

## Deployment

Production deployment is handled by GitHub Actions after changes reach `main`.

The workflow:

1. checks Cloudflare CI credentials;
2. installs dependencies;
3. runs the production build and regression suite;
4. resolves the existing D1 database and R2 bucket;
5. validates the generated Worker artifact;
6. deploys with Wrangler while preserving production variables/secrets.

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Application/payment/legal secrets belong in the Cloudflare Worker environment and must not be committed to the repository.

## Quality gates

Regression coverage currently targets high-risk production behaviour, including:

- legal pages and checkout gating;
- VAT presentation modes;
- Stripe order-confirmation path;
- review transparency and rate limiting;
- privacy/CSP behaviour;
- Android privacy interaction regressions;
- VAT MutationObserver loop prevention;
- owner-route protection;
- stale HTML/privacy cache prevention;
- baseline browser security headers;
- PWA manifest configuration;
- robots/sitemap exposure;
- modal focus management;
- owner production-readiness dashboard.

## Go-live status

A successful build/deployment does **not** automatically mean consumer sales are legally enabled. The production checkout gate remains the source of truth for go-live readiness.

See:

- `LEGAL-COMPLIANCE-PL-2026.md`
- GitHub issue: **Go-live PL 2026: zadania prawne i operacyjne poza kodem**

## License

This repository currently contains a **GNU General Public License v3.0** license file. Any future relicensing should be preceded by a copyright/contributor/dependency-license review rather than simply removing the existing license.
