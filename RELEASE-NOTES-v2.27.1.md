# HySmart Station Frontend v2.27.1

## Changes in this package

- Replaced the Sales & Reconciliation page with the complete corrected offline-sync implementation, including a synchronization lock, account-scoped queue refresh, endpoint/payload checks, sequential processing, and review-required handling for blocked records.
- Blocked or failed earlier readings now stop later queued readings from overtaking them.
- Business dates are initialized using the browser's local calendar date rather than UTC.
- Fixed the IndexedDB queue update helper so it returns the committed updated record instead of referencing a callback-scoped variable.
- Duplicate offline idempotency keys are compared using stable object-key ordering and conflicting content is rejected without aborting the read transaction.
- Production builds now fail clearly if the API URL is not configured; localhost remains a development-only fallback.
- Updated the service-worker and generated asset-manifest release version to 2.27.1.
- Bumped the frontend package version to 2.27.1.

## Checks performed in the review environment

- Parsed all JavaScript and JSX source files with the installed TypeScript parser: passed.
- Checked relative JavaScript/JSX imports: passed.
- Ran Node syntax checks on `src/lib/offlineQueue.js`, `src/lib/api.js`, `public/sw.js`, and `vite.config.js`: passed.
- A full Vite build and Vitest run could not be completed because this review environment could not reach `registry.npmjs.org` to install the locked dependencies (`EAI_AGAIN`). Run the commands below on your development machine.

## Required local verification

```bash
npm ci
npm test
npm run build
```

Then deploy to a staging HTTPS origin and complete the offline workflow tests in `README.md`.

## Important

This is a frontend-only release. The backend source was not included in the supplied archive, so backend idempotency and database concurrency guarantees have not been verified. Do not mark the overall product production-ready for live financial operations until the backend and end-to-end release gates pass.
