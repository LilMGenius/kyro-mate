import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.KYRO_API_BASE_URL || 'https://kyro-hackathon.vercel.app';
  const apiKey = env.KYRO_API_KEY || env.KYRO_API_TOKEN;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/runs': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/runs/, '/api/v1/runs'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
        '/api/friends-runs': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/friends-runs/, '/api/v1/friends/runs'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
        '/api/run-detail': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/run-detail\?id=([^&]+)/, '/api/v1/runs/$1?'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
      },
    },
  };
});
