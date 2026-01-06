import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  host_permissions: ['<all_urls>'],
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      matches: ['https://*/*'],
    },
    {
      js: ['src/utils/xhrInject.ts'],
      matches: ['https://*/*'],
      world: 'MAIN',
    },
  ],
  permissions: [
    'sidePanel',
    'contentSettings',
    'activeTab',
    'scripting',
    'storage',
    'webRequest',
    'alarms',
  ],

  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
});
