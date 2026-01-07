import { createApp } from 'vue';
import App from './views/App.vue';
import '@/assets/style/reset.scss';
import 'virtual:uno.css';
import { initContentScript } from '@/common/content';
import './background';

/**
 * Mount the Vue app to the DOM.
 */
function mountApp() {
  const container = document.createElement('div');

  container.id = 'crxjs-app';
  // 使用内联样式确保定位，避免被页面样式覆盖

  document.body.appendChild(container);
  const app = createApp(App);
  app.mount(container);
  initContentScript();
}

mountApp();
