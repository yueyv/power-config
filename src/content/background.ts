import { BACKGROUND_CONTENT_CONNECTION_NAME, CONNECT_STATUS } from '@/constants';

const backgroundConnection = chrome.runtime.connect({ name: BACKGROUND_CONTENT_CONNECTION_NAME });
backgroundConnection.onMessage.addListener((msg) => {
  switch (msg.status) {
    case CONNECT_STATUS.CONNECT:
      console.log('background 连接成功');
      break;
    case CONNECT_STATUS.CLICK_EVENT:
      clickApplyBtn();
      break;
    default:
      break;
  }
});

export function sendMessageToBackground(message: BackgroundConnectionMessage) {
  if (backgroundConnection) {
    backgroundConnection.postMessage(message);
  }
}

sendMessageToBackground({
  status: CONNECT_STATUS.CREATE,
});

function clickApplyBtn() {
  const button = document.querySelector('button.el-button.applay-btn');

  if (button) {
    button.addEventListener('click', (event: Event) => {
      console.log('点击按钮', event);
    });
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    button.dispatchEvent(clickEvent);
  }
}
