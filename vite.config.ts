import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const FIREBASE_CONFIG_PATH = '/firebase-applet-config.json';

/**
 * `public/firebase-messaging-sw.js` fetches `/firebase-applet-config.json` at
 * runtime, but the config file lives in the project root (not in `public/`), so
 * the request 404s without this. Serve it in dev and emit it into the build —
 * keeping a single source of truth at the root.
 *
 * IMPORTANT: Vite resolves the app's `import ... from 'firebase-applet-config.json'`
 * to this same path plus `?import`, and serves that as a JS **module**. Only the
 * bare path may be answered with raw JSON here, otherwise the module request gets
 * `Content-Type: application/json` and the browser refuses it with
 * "Failed to load module script: Expected a JavaScript-or-Wasm module script".
 */
const firebaseConfigFile = (): Plugin => ({
  name: 'firebase-applet-config',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const [pathname, query] = (req.url || '').split('?');
      const isBareConfigRequest =
        req.method === 'GET' && query === undefined && pathname === FIREBASE_CONFIG_PATH;

      // Anything else (`?import`, other paths) belongs to Vite's own handlers
      if (!isBareConfigRequest) return next();

      res.setHeader('Content-Type', 'application/json');
      res.end(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json')));
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: FIREBASE_CONFIG_PATH.slice(1),
      source: fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf-8'),
    });
  },
});

export default defineConfig(() => {
  return {
    plugins: [firebaseConfigFile(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
