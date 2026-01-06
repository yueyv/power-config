import { LOGGER_TARGET, XHR_PORT_NAME } from '@/constants';
import { logInfo } from '@/utils/log';

// 监听来自 content script 的连接
chrome.runtime.onConnect.addListener((port) => {
  logInfo(LOGGER_TARGET.BACKGROUND, '收到来自 content script 的连接，连接名称:', port.name);

  // 验证连接名称
  if (port.name === 'content-script') {
    // 接收消息
    port.onMessage.addListener((msg) => {
      logInfo(LOGGER_TARGET.BACKGROUND, 'Background 收到消息:', msg);

      // 处理不同的消息类型
      if (msg.action === 'startMonitoring') {
        // 回复消息给 content script
        port.postMessage({
          action: 'monitoringStarted',
          status: 'success',
        });
      }
    });

    // 断开连接
    port.onDisconnect.addListener(() => {
      logInfo(LOGGER_TARGET.BACKGROUND, 'Content script 连接已断开');
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === XHR_PORT_NAME) {
    logInfo(LOGGER_TARGET.BACKGROUND, 'Background 收到消息:', message.message);
  }
});
