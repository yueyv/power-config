import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  host_permissions: ['<all_urls>', 'file:///*'],
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
      matches: ['https://*/*', 'file:///*'],
    },
    {
      js: ['src/utils/xhrInject.ts'],
      matches: ['https://*/*', 'file:///*'],
      all_frames: true,
      match_about_blank: true,
      run_at: 'document_end',
      world: 'MAIN',
    },
    {
      js: ['src/utils/fetchInject.ts'],
      matches: ['https://*/*', 'file:///*'],
      all_frames: true,
      match_about_blank: true,
      run_at: 'document_end',
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
