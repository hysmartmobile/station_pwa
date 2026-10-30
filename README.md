# HySmart Station PWA

## Environment

Copy `.env.example` to `.env` for local development and set the public frontend configuration values. Production builds must set `VITE_API_URL` (or `VITE_API_BASE_URL`) to the deployed API origin. The frontend deliberately does not fall back to `localhost` in production. Never place Supabase service-role keys, Paystack secret keys, or other server secrets in `VITE_*` variables.

## Offline operations (v2.27.1 frontend update)

- The production service worker caches the application shell and static build assets. API/authenticated responses are not cached.
- The Sales & Reconciliation page can durably queue **litre and LPG kilogram meter readings only** when a request fails due to a network outage.
- Each queued reading retains the same idempotency key for retry. When connectivity returns, the client submits the queued records sequentially using the current signed-in session; the backend still validates the current user, branch, shift, nozzle roster, meter monotonicity and approval rules.
- If server validation fails (for example, the cashier shift is no longer open), the record is marked `Needs review` and the queue stops rather than silently dropping or bypassing the rule.
- Local records are explicitly labelled pending. They are not official records and do not contribute to official totals until the server accepts them.
- Collections, stock checks, shift reconciliation, approvals, authentication and other financial workflows are **not** queued offline. Do not tell attendants that the whole station can operate fully offline.
- Pending records are stored in IndexedDB on the device, scoped to the signed-in user. Shared-device controls, device loss, browser storage eviction and local data protection must be included in station operating procedures.

## Release scope and production gate

This repository is the **frontend/PWA only**. It does not contain the HySmart Station API server, database migrations, Supabase policies, or server-side meter-reading handlers. The frontend can be prepared and built here, but it cannot independently prove server-side idempotency, authorization, meter concurrency safety, approval enforcement, or financial correctness. Do not treat a successful frontend build as authorization to process live station transactions until the matching backend release has passed its own checks and the end-to-end staging checklist below.

## Release verification checklist

1. Run `npm ci`, `npm test`, and `npm run build` in the frontend directory. Run these commands from a network-enabled environment because dependencies are not bundled with this source archive.
2. Run `npm ci`, `npm run check`, and `npm test` in the backend directory.
3. Test on the actual production HTTPS origin: install/open online, reload offline, submit a litre reading and a kg reading offline, restart the browser, reconnect, and verify each accepted record appears once and remains subject to manager approval.
4. Test a queued reading after the cashier shift closes, a meter rollback, a disabled nozzle, and an unapproved opening meter. Confirm the queue flags review and does not bypass server validation.
5. Verify collections and all other non-queued actions clearly fail while offline and are never represented as successful.
6. Confirm the browser/device's IndexedDB persistence and storage behavior on the exact devices used at the station.

A production release is not certified solely by a successful build. Complete the above tests against a staging Supabase project and the deployed HTTPS environment before live rollout.
