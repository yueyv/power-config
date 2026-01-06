import { createApp } from 'vue';
import App from './views/App.vue';
import { initContentScript } from '@/common/content';
import 'virtual:uno.css';
import '@/assets/style/reset.scss';

console.log('[CRXJS] Hello world from content script!');

/**
 * Mount the Vue app to the DOM.
 */
function mountApp() {
  const container = document.createElement('div');
  container.id = 'crxjs-app';
  document.body.appendChild(container);
  const app = createApp(App);
  app.mount(container);
  initContentScript();
}

mountApp();
