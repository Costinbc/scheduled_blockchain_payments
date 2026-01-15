import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    svgr(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  resolve: {
    alias: {
      stream: 'stream-browserify'
    }
  },
  optimizeDeps: {
    exclude: ['@multiversx/sdk-dapp'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: false,
      ignored: ['**/.cache/**']
    },
    hmr: {
      overlay: false
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  }
});
