import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'vite-hmr-preview-compat',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code
              .replace(
                'console.debug("[vite] connecting...");',
                '// [vite] HMR WebSocket disabled in Google AI Studio Preview'
              )
              .replace(
                'const createWebSocketModuleRunnerTransport = (options) => {',
                'const createWebSocketModuleRunnerTransport = () => ({ async connect() {}, async disconnect() {}, send() {} }); const _original_ws_transport = (options) => {'
              );
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio Preview environment to prevent WebSocket connection errors
      // through the reverse proxy. The platform refreshes the preview automatically.
      hmr: false,
      watch: null,
    },
  };
});
