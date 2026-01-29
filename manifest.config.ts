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
      matches: ['http://*/*', 'https://*/*'],
    },
    // {
    //   js: ['src/utils/xhrInject.ts'],
    //   //   matches: ['https://*/*'],
    //   matches: ['file:///*'],
    //   all_frames: true,
    //   match_about_blank: true,
    //   run_at: 'document_end',
    // },
    // {
    //   js: ['src/utils/fetchInject.ts'],
    //   //   matches: ['https://*/*'],
    //   matches: ['file:///*'],
    //   all_frames: true,
    //   match_about_blank: true,
    //   run_at: 'document_end',
    // },
    {
      js: ['src/utils/execution.ts'],
      matches: ['http://*/*', 'https://*/*'],
      match_about_blank: true,
      run_at: 'document_end',
      world: 'MAIN',
    },
  ],
  permissions: ['contentSettings', 'activeTab', 'scripting', 'storage', 'webRequest', 'alarms'],

  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
});
