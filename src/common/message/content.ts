import { XHR_PORT_NAME } from '@/constants';
import { FETCH_PORT_NAME } from '@/constants';
import { SCRIPT_LOGGER_PORT_NAME } from '@/constants';
import { receiveLoggerMessage } from '../log';

export function initContentScript() {
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data) {
      return;
    }
    switch (event.data.type) {
      // 从注入的content script 发送过来的XHR消息转发给background
      case XHR_PORT_NAME:
        chrome.runtime.sendMessage({
          type: XHR_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的Fetch消息转发给background
      case FETCH_PORT_NAME:
        chrome.runtime.sendMessage({
          type: FETCH_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的日志消息转发给background
      case SCRIPT_LOGGER_PORT_NAME:
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
