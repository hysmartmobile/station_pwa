
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Generates a manifest containing the production JS and static assets.
 * The service worker can use this manifest to precache application assets.
 */
function offlineAssetManifest() {
  return {
    name: 'hysmart-offline-asset-manifest',

    apply: 'build',

    generateBundle(_options, bundle) {
      const assets = [
        ...new Set(
          Object.values(bundle)
            .filter((item) => {
              if (item.type === 'chunk') {
                return true;
              }

              if (item.type !== 'asset') {
                return false;
              }

              return /\.(?:css|woff2?|ttf|otf|eot|svg|png|webp|jpe?g|gif|ico)$/i.test(
                item.fileName
              );
            })
            .map((item) => `/${item.fileName}`)
        ),
      ].sort();

      this.emitFile({
        type: 'asset',
        fileName: 'asset-manifest.json',
        source: JSON.stringify(
          {
            version: '2.27.1',
            generatedAt: new Date().toISOString(),
            assets,
          },
          null,
          2
        ),
      });
    },
  };
}

/**
 * Separates major dependencies into predictable production chunks.
 */
function manualChunks(id) {
  const normalizedId = id.replace(/\\/g, '/');

  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }

  if (
    normalizedId.includes('/node_modules/react-router/') ||
    normalizedId.includes('/node_modules/react-router-dom/')
  ) {
    return 'vendor-router';
  }

  if (normalizedId.includes('/node_modules/@supabase/')) {
    return 'vendor-supabase';
  }

  if (normalizedId.includes('/node_modules/lucide-react/')) {
    return 'vendor-icons';
  }

  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    offlineAssetManifest(),
  ],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    clearMocks: true,
    restoreMocks: true,
  },

  build: {
    // Keep the warning meaningful rather than hiding oversized bundles.
    chunkSizeWarningLimit: 500,

    // Generate production source maps only if explicitly needed.
    sourcemap: false,

    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
