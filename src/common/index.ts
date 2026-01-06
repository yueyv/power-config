import { XHR_PORT_NAME } from '@/constants';
import { DOMAIN } from '@/constants';

export function sendXHRMessage(message: any) {
  window.postMessage(
    {
      type: XHR_PORT_NAME,
      message,
    },
    DOMAIN
  );
}

export function handleXHRMessage() {
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data || event.data.type !== XHR_PORT_NAME) {
      return;
    }

    chrome.runtime.sendMessage({
      type: XHR_PORT_NAME,
      message: event.data.message,
    });
  });
}
