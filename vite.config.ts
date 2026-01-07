import path from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';
import { name, version } from './package.json';

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    vue(),
    vueJsx(),

    AutoImport({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass',
        }),
      ],
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass',
        }),
      ],
    }),
    UnoCSS({
      virtualModulePrefix: '@uno_',
    }),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'crx:dynamic-imports-polyfill',
          generateBundle(_, bundle) {
            const polyfill = `
                (function () {
                  const chrome = window.chrome || {};
                  chrome.runtime = chrome.runtime || {};
                  chrome.runtime.getURL = chrome.runtime.getURL || function(path) { return path.replace("assets/", "./"); };
                })();
            `;
            for (const chunk of Object.values(bundle)) {
              if (
                chunk.name?.endsWith('-loader.js') &&
                'source' in chunk &&
                typeof chunk.source === 'string' &&
                chunk.source.includes('chrome.runtime.getURL') &&
                !chunk.source.includes(polyfill)
              ) {
                chunk.source = `
                  ${polyfill}
                  ${chunk.source}
                `;
              }
            }
          },
        },
      ],
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
