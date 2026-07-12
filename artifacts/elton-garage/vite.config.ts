import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// PORT is only needed for the dev server — not for `vite build`.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

// BASE_PATH defaults to "/" when not set (e.g. on Netlify).
const basePath = process.env.BASE_PATH ?? '/';

const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];

  // Replit-only plugins — only load inside a Replit workspace
  if (isReplit) {
    const [{ default: runtimeErrorOverlay }, cartographerMod, devBannerMod] =
      await Promise.all([
        import('@replit/vite-plugin-runtime-error-modal'),
        isDev ? import('@replit/vite-plugin-cartographer') : Promise.resolve(null),
        isDev ? import('@replit/vite-plugin-dev-banner') : Promise.resolve(null),
      ]);

    plugins.push(runtimeErrorOverlay());

    if (cartographerMod) {
      plugins.push(
        cartographerMod.cartographer({
          root: path.resolve(import.meta.dirname, '..'),
        }),
      );
    }
    if (devBannerMod) {
      plugins.push(devBannerMod.devBanner());
    }
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2500,
      reportCompressedSize: false,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
      // Proxy /api to the backend in dev (set API_PORT or default 3001)
      proxy: process.env.VITE_API_URL ? undefined : {
        '/api': {
          target: `http://localhost:${process.env.API_PORT ?? 3001}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
