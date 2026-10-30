
/**
 * HySmart Station — Production PWA Service Worker
 * Version: 2.27.1
 *
 * Responsibilities:
 * - Precache the application shell and Vite entry assets.
 * - Precache generated static assets where available.
 * - Support offline navigation using the cached application shell.
 * - Cache only same-origin, public static assets.
 * - Never cache API, authentication, Supabase or business responses.
 * - Remove obsolete HySmart static caches during activation.
 *
 * Important:
 * - This worker does not cache POST, PUT, PATCH or DELETE requests.
 * - It does not cache user-specific API responses.
 * - Offline business operations must use the application's
 *   separate IndexedDB outbox and synchronization logic.
 */

'use strict';

const CACHE_PREFIX = 'hysmart-static-';
const CACHE_VERSION = 'v2.27.1';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const OPTIONAL_SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/icons/hysmart-192.png',
  '/icons/hysmart-512.png',
  '/icons/hysmart-maskable-512.png',
];

const ASSET_MANIFEST_URL = '/asset-manifest.json';

const STATIC_PATH_PREFIXES = [
  '/assets/',
  '/icons/',
];

const STATIC_EXACT_PATHS = new Set([
  '/index.html',
  '/manifest.webmanifest',
  '/asset-manifest.json',
]);

/**
 * Paths that must never be cached.
 * These include API and authentication endpoints,
 * Supabase endpoints and private application routes.
 */
function isPrivateOrApiPath(pathname) {
  const path = pathname.toLowerCase();

  const privatePrefixes = [
    '/api',
    '/auth',
    '/rest',
    '/storage',
    '/functions',
    '/graphql',
  ];

  if (
    privatePrefixes.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }

  return (
    path.includes('supabase') ||
    path.includes('/private/') ||
    path.includes('/session/')
  );
}

/**
 * Only allow known public static application resources.
 */
function isCacheableStaticPath(pathname) {
  if (isPrivateOrApiPath(pathname)) {
    return false;
  }

  return (
    STATIC_EXACT_PATHS.has(pathname) ||
    STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Validate and normalize an asset URL.
 * Reject external URLs, malformed URLs and private paths.
 */
function getSafeStaticUrl(assetPath) {
  if (
    typeof assetPath !== 'string' ||
    !assetPath.startsWith('/') ||
    assetPath.startsWith('//')
  ) {
    return null;
  }

  try {
    const url = new URL(assetPath, self.location.origin);

    if (url.origin !== self.location.origin) {
      return null;
    }

    if (!isCacheableStaticPath(url.pathname)) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

/**
 * Fetch a public static asset and store it in the current cache.
 */
async function fetchAndCacheStaticAsset(cache, assetPath) {
  const url = getSafeStaticUrl(assetPath);

  if (!url) {
    throw new Error(`Rejected static asset: ${String(assetPath)}`);
  }

  const response = await fetch(url.href, {
    method: 'GET',
    cache: 'reload',
    credentials: 'same-origin',
    redirect: 'error',
  });

  if (!response.ok || response.type !== 'basic') {
    throw new Error(
      `Static asset unavailable: ${url.pathname} (${response.status})`
    );
  }

  await cache.put(url.href, response.clone());

  return response;
}

/**
 * Required assets must be available before installation succeeds.
 */
async function fetchAndCacheRequiredAsset(cache, assetPath) {
  return fetchAndCacheStaticAsset(cache, assetPath);
}

/**
 * Extract Vite's initial JavaScript and stylesheet assets from index.html.
 *
 * These assets are required for the offline application shell to start.
 * Lazy-loaded route chunks are handled separately as optional assets.
 */
function extractEntryAssets(html) {
  const assets = new Set();

  const scriptPattern =
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

  const stylesheetPattern =
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    assets.add(match[1]);
  }

  while ((match = stylesheetPattern.exec(html)) !== null) {
    const tag = match[0];

    if (/\brel=["']stylesheet["']/i.test(tag)) {
      assets.add(match[1]);
    }
  }

  return [...assets];
}

/**
 * Cache Vite's required initial JavaScript and CSS.
 * Installation fails if an initial entry asset cannot be cached.
 */
async function cacheRequiredEntryAssets(cache, html) {
  const entryAssets = extractEntryAssets(html);

  if (entryAssets.length === 0) {
    throw new Error(
      'No initial JavaScript or stylesheet assets found in index.html.'
    );
  }

  await Promise.all(
    entryAssets.map((assetPath) =>
      fetchAndCacheRequiredAsset(cache, assetPath)
    )
  );
}

/**
 * Cache the optional generated asset manifest.
 */
async function cacheGeneratedAssets(cache) {
  try {
    const manifestUrl = new URL(
      ASSET_MANIFEST_URL,
      self.location.origin
    );

    const response = await fetch(manifestUrl.href, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok || response.type !== 'basic') {
      console.warn(
        'HySmart: asset manifest unavailable; optional precaching skipped.'
      );
      return;
    }

    const manifest = await response.json();

    if (!manifest || !Array.isArray(manifest.assets)) {
      console.warn('HySmart: invalid asset manifest.');
      return;
    }

    const uniqueAssets = [...new Set(manifest.assets)];

    // Optional assets are independent. A missing lazy-loaded chunk
    // must not prevent the rest of the application from installing.
    const results = await Promise.allSettled(
      uniqueAssets.map((assetPath) =>
        fetchAndCacheStaticAsset(cache, assetPath)
      )
    );

    const failures = results.filter(
      (result) => result.status === 'rejected'
    ).length;

    if (failures > 0) {
      console.warn(
        `HySmart: ${failures} optional generated asset(s) could not be cached.`
      );
    }
  } catch (error) {
    console.warn(
      'HySmart: optional generated asset precaching failed:',
      error
    );
  }
}

/**
 * Cache optional application resources independently.
 */
async function cacheOptionalShellAssets(cache) {
  const results = await Promise.allSettled(
    OPTIONAL_SHELL_ASSETS.map((assetPath) =>
      fetchAndCacheStaticAsset(cache, assetPath)
    )
  );

  const failures = results.filter(
    (result) => result.status === 'rejected'
  ).length;

  if (failures > 0) {
    console.warn(
      `HySmart: ${failures} optional shell asset(s) unavailable.`
    );
  }
}

/**
 * INSTALL
 *
 * The application shell and initial Vite entry assets are required.
 * Optional icons, manifest and lazy-loaded assets cannot prevent
 * installation when unavailable.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        // Fetch and cache the canonical SPA entry document.
        const indexResponse = await fetchAndCacheRequiredAsset(
          cache,
          '/index.html'
        );

        // Store the same application shell under the root URL.
        await cache.put('/', indexResponse.clone());

        const html = await indexResponse.clone().text();

        // Ensure the initial application JavaScript and CSS are cached.
        await cacheRequiredEntryAssets(cache, html);

        // Optional resources must not block installation.
        await cacheOptionalShellAssets(cache);
        await cacheGeneratedAssets(cache);

        await self.skipWaiting();
      } catch (error) {
        // Remove incomplete cache so a later installation can retry.
        await caches.delete(CACHE_NAME);

        console.error(
          'HySmart service worker installation failed:',
          error
        );

        throw error;
      }
    })()
  );
});

/**
 * ACTIVATE
 *
 * Remove only obsolete caches owned by this service worker.
 * Other applications' caches are not touched.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) &&
              cacheName !== CACHE_NAME
          )
          .map((cacheName) => caches.delete(cacheName))
      );

      await self.clients.claim();

      console.info(
        `HySmart service worker activated: ${CACHE_VERSION}`
      );
    })()
  );
});

/**
 * NETWORK-FIRST NAVIGATION
 *
 * Online:
 * - Request the actual navigation from the server.
 *
 * Offline:
 * - Return the cached SPA application shell.
 *
 * Navigation responses are deliberately not cached because they
 * may contain user-specific or server-generated information.
 */
async function handleNavigationRequest() {
  try {
    return await fetch(new Request('/index.html', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-cache',
    }));
  } catch {
    const cache = await caches.open(CACHE_NAME);

    const cachedShell =
      (await cache.match('/index.html')) ||
      (await cache.match('/'));

    if (cachedShell) {
      return cachedShell;
    }

    return new Response(
      'HySmart Station is unavailable offline. Please reconnect and try again.',
      {
        status: 503,
        statusText: 'Offline',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

/**
 * CACHE-FIRST STATIC ASSETS
 *
 * Only successful same-origin public static responses are cached.
 */
async function handleStaticAssetRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type === 'basic'
    ) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return new Response(
      'This resource is not available offline.',
      {
        status: 503,
        statusText: 'Offline',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

/**
 * FETCH
 *
 * Never intercept or cache:
 * - Non-GET requests.
 * - Cross-origin requests.
 * - API and authentication endpoints.
 * - Supabase requests.
 * - Private/business data endpoints.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  let url;

  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isPrivateOrApiPath(url.pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest());
    return;
  }

  if (isCacheableStaticPath(url.pathname)) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});
