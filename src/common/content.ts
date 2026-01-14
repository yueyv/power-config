import { XHR_PORT_NAME } from '@/constants';
import { FETCH_PORT_NAME } from '@/constants';
import { XHR_LOGGER_PORT_NAME } from '@/constants';
import { receiveLoggerMessage } from './log';

export function initContentScript() {
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data) {
      return;
    }
    switch (event.data.type) {
      case XHR_PORT_NAME:
        chrome.runtime.sendMessage({
          type: XHR_PORT_NAME,
          message: event.data.message,
        });
        break;
      case FETCH_PORT_NAME:
        chrome.runtime.sendMessage({
          type: FETCH_PORT_NAME,
          message: event.data.message,
        });
        break;
      case XHR_LOGGER_PORT_NAME:
        receiveLoggerMessage(
          JSON.parse(event.data.message).level,
          JSON.parse(event.data.message).message,
          JSON.parse(event.data.message)?.data || null
        );
        break;
      default:
        break;
    }
  });
}
