import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function offlineAssetManifest() {
  return {
    name: 'hysmart-offline-asset-manifest',
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle)
        .filter((item) => item.type === 'chunk' || (item.type === 'asset' && /\.(css|woff2?|ttf|svg|png|webp|jpg|jpeg)$/i.test(item.fileName)))
        .map((item) => `/${item.fileName}`);
      this.emitFile({
        type: 'asset',
        fileName: 'asset-manifest.json',
        source: JSON.stringify({ version: '2.27.0', assets }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineAssetManifest()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
  build: {
    // Keep the warning meaningful; split dependencies instead of hiding it.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')) {
            return 'vendor-react';
          }

          if (id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')) {
            return 'vendor-router';
          }

          if (id.includes('/node_modules/@supabase/')) {
            return 'vendor-supabase';
          }

          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }

          return undefined;
        },
      },
    },
  },
});
