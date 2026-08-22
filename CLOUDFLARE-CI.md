# Cloudflare production deployment from GitHub Actions

A-Bags Handmade deploys the production Cloudflare Worker automatically after every push to `main` through `.github/workflows/deploy-cloudflare.yml`.

## Required GitHub Actions secrets

Configure these in GitHub repository settings under Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID that owns the production Worker.
- `CLOUDFLARE_API_TOKEN` — scoped Cloudflare API token used only by CI/CD.

Never commit either value to the repository.

## Recommended Cloudflare token scope

Scope the token to the production Cloudflare account and the `abagshandmade.pl` zone only. The deployment needs enough access to:

- write/deploy Workers scripts,
- read the existing D1 database so `scripts/patch-deploy-config.mjs` can resolve its UUID,
- read the existing R2 bucket so the build can bind to the existing media bucket,
- manage the Worker route/custom domain for the production zone.

Do not use a Global API Key for CI/CD.

## Deployment pipeline

The workflow performs the following gates in order:

1. verifies that both Cloudflare GitHub secrets are present;
2. installs the locked npm dependencies with `npm ci`;
3. runs the full build and regression tests with remote Cloudflare discovery disabled;
4. resolves the existing production D1/R2 resources using authenticated Wrangler;
5. validates the generated deployment artifact;
6. deploys `dist/server/wrangler.json` with `--keep-vars` so dashboard-managed Worker variables are preserved.

Deployments are serialized with the `cloudflare-production` concurrency group so two production deployments do not run at the same time.

## Existing production resources expected by the build

The resource resolver currently expects:

- D1: `a-bags-handmade-storedb` (or the generated binding-derived name),
- R2: `a-bags-handmade-storemedia` (or the generated binding-derived name).

If those resource names are changed in Cloudflare, update `scripts/patch-deploy-config.mjs` before the next deployment.

## Production safety

The Worker keeps checkout fail-closed until the Legal & Compliance runtime configuration is complete. A successful code deployment does not bypass the legal go-live gate.
