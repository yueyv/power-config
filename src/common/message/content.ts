import { EXECUTION_TYPE, XHR_PORT_NAME } from '@/constants';
import { FETCH_PORT_NAME } from '@/constants';
import { SCRIPT_LOGGER_PORT_NAME } from '@/constants';
import { receiveLoggerMessage } from '../log';
import { BACKGROUND_CONTENT_CONNECTION_NAME, CONNECT_STATUS } from '@/constants';
import { ref } from 'vue';
import { logInfo } from '@/model/log';
import { setSellData } from '@/model/sellData';

export function useBackgroundConnection() {
  const backgroundConnection = chrome.runtime.connect({ name: BACKGROUND_CONTENT_CONNECTION_NAME });
  const sellData = ref<SELL_DATA_ITEM[]>([]);
  // 监听消息
  backgroundConnection.onMessage.addListener((msg) => {
    switch (msg.status) {
      case CONNECT_STATUS.CONNECT:
        console.log('background 连接成功');
        break;
      default:
        break;
    }
  });

  // 监听消息
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data) {
      return;
    }
    switch (event.data.type) {
      // 从注入的content script 发送过来的XHR消息转发给background
      case XHR_PORT_NAME:
        if (event.data.message.status === 200) {
          sellData.value = JSON.parse(event.data.message.responseData);
        }

        chrome.runtime.sendMessage({
          type: XHR_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的Fetch消息转发给background
      case FETCH_PORT_NAME:
        if (event.data.message.status === 200) {
          sellData.value = JSON.parse(event.data.message.responseData);
        }
        chrome.runtime.sendMessage({
          type: FETCH_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的日志消息转发给background
      case SCRIPT_LOGGER_PORT_NAME:
      case EXECUTION_TYPE.LOG_INFO:
        receiveLoggerMessage(
          JSON.parse(event.data.message).level,
          JSON.parse(event.data.message).message,
          JSON.parse(event.data.message)?.data || null
        );
        break;
      case EXECUTION_TYPE.GET_SELL_DATA:
        sellData.value = JSON.parse(event.data.message).data;
        logInfo('content', '获取挂牌数据成功', sellData.value);
        setSellData(sellData.value);
        break;
      default:
        break;
    }
  });
  function sendMessageToBackground(message: BackgroundConnectionMessage) {
    if (backgroundConnection) {
      backgroundConnection.postMessage(message);
    }
  }

  function initIframe() {
    window.postMessage(
      {
        type: EXECUTION_TYPE.INITIFRAME,
      },
      '*'
    );
  }
  return {
    sendMessageToBackground,
    initIframe,
    sellData,
  };
}
