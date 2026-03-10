import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './views/App.vue';
import '@/assets/style/reset.scss';
import 'virtual:uno.css';

/**
 * Mount the Vue app to the DOM.
 */
function mountApp() {
  const container = document.createElement('div');

  container.id = 'crxjs-app';
  // 使用内联样式确保定位，避免被页面样式覆盖

  document.body.appendChild(container);
  const app = createApp(App);
  app.use(createPinia());
  app.mount(container);
}

mountApp();
