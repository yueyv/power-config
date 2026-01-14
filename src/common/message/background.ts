import { BACKGROUND_CONTENT_CONNECTION_NAME, CONNECT_STATUS, XHR_PORT_NAME } from '@/constants';
export default function useBackgroundConnection() {
  // 连接池：使用 Map 存储所有连接，key 是 tabId，value 是 port
  const contentPorts = new Map<number, chrome.runtime.Port>();

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === BACKGROUND_CONTENT_CONNECTION_NAME) {
      // 获取连接的标签页 ID
      const sender = port.sender;
      const tabId = sender?.tab?.id;

      if (tabId) {
        // 如果已存在该标签页的连接，先断开旧连接
        const existingPort = contentPorts.get(tabId);
        if (existingPort) {
          existingPort.disconnect();
        }

        // 保存新连接
        contentPorts.set(tabId, port);
        console.log(
          `创建content script 连接，标签页 ID: ${tabId}，当前连接数: ${contentPorts.size}`
        );

        // 监听消息
        port.onMessage.addListener((msg: BackgroundConnectionMessage) => {
          switch (msg.status) {
            case CONNECT_STATUS.CREATE:
              console.log(`收到来自标签页 ${tabId} 的连接请求`);
              port.postMessage({
                status: CONNECT_STATUS.CONNECT,
              });
              break;
            default:
              break;
          }
        });

        // 监听断开连接
        port.onDisconnect.addListener(() => {
          contentPorts.delete(tabId);
          console.log(`标签页 ${tabId} 连接已断开，当前连接数: ${contentPorts.size}`);
        });
      } else {
        console.warn('无法获取标签页 ID，连接将被忽略');
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender?.tab?.id;
    if (message.type === XHR_PORT_NAME && tabId) {
      console.log('Background 收到消息:', message.message);
      chrome.alarms
        .create(CONNECT_STATUS.CLICK_EVENT, {
          when: Date.now() + 5000,
        })
        .then(() => {
          sendMessageToContent(tabId, {
            status: CONNECT_STATUS.CLICK_EVENT,
          });
        })
        .catch((err) => {
          console.error('Failed to create alarm:', err);
        });
    }
  });

  /**
   * 向所有连接的 content script 广播消息
   */
  function broadcastToAllContent(message: BackgroundConnectionMessage) {
    contentPorts.forEach((port, tabId) => {
      try {
        port.postMessage(message);
      } catch (err) {
        console.error(`向标签页 ${tabId} 发送消息失败:`, err);
        contentPorts.delete(tabId);
      }
    });
  }

  /**
   * 向特定标签页的 content script 发送消息
   */
  function sendMessageToContent(tabId: number, message: BackgroundConnectionMessage) {
    const port = contentPorts.get(tabId);
    if (port) {
      try {
        port.postMessage(message);
      } catch (err) {
        console.error(`向标签页 ${tabId} 发送消息失败:`, err);
        contentPorts.delete(tabId);
      }
    } else {
      console.warn(`标签页 ${tabId} 未连接`);
    }
  }

  /**
   * 向当前活动标签页发送消息
   */
  function sendMessageToActiveTab(message: BackgroundConnectionMessage) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        sendMessageToContent(tabs[0].id, message);
      }
    });
  }

  /**
   * 获取所有连接的标签页 ID
   */
  function getConnectedTabIds(): number[] {
    return Array.from(contentPorts.keys());
  }

  /**
   * 获取连接数量
   */
  function getConnectionCount(): number {
    return contentPorts.size;
  }
  return {
    broadcastToAllContent,
    sendMessageToContent,
    sendMessageToActiveTab,
    getConnectedTabIds,
    getConnectionCount,
  };
}
