# HySmart Station Frontend v2.27.0

## Production performance
- Converted route page imports in `src/App.jsx` to React lazy imports.
- Added a shared Suspense loading fallback while route chunks are downloaded.
- Split React, React Router, Supabase, and Lucide dependencies into dedicated vendor chunks.
- Added a build-generated `asset-manifest.json` containing generated route chunks and static assets.

## Offline PWA
- Preserved the existing service-worker registration, app-shell fallback, IndexedDB offline queue, and API/auth cache exclusions.
- Updated the service-worker cache version to `v2.27.0` so clients replace the prior static cache.
- Service-worker installation now precaches generated lazy route chunks from `asset-manifest.json`, allowing routes to remain available offline after a successful online installation.

## Preserved application behaviour
- Existing route paths, authentication guards, Creator Administrator authorization check, trial-expiry handling, billing flow, and sign-out flow are unchanged.

## Verification status
- Source/configuration changes are included.
- `npm ci` could not complete in the build environment (dependency installation timed out), so `npm test` and `npm run build` could not be executed here. Run both after installing dependencies in the project directory.
