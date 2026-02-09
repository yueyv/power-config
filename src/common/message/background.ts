import {
  BACKGROUND_CONTENT_CONNECTION_NAME,
  CONNECT_STATUS,
  LOGGER_LEVEL,
  XHR_PORT_NAME,
  SLIDER_POSITION_API,
} from '@/constants';
import { setLogger } from '@/model/log';
import { setSellData } from '@/model/sellData';
import { backgroundLogger } from '@/utils/logger';
export default function useBackgroundConnection() {
  // 连接池：使用 Map 存储所有连接，key 是 tabId，value 是 port
  const contentPorts = new Map<number, chrome.runtime.Port>();
  // 创建连接
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
        backgroundLogger.info(
          `创建content script 连接，标签页 ID: ${tabId}，当前连接数: ${contentPorts.size}`
        );

        // 监听消息
        port.onMessage.addListener((msg: BackgroundConnectionMessage) => {
          switch (msg.status) {
            case CONNECT_STATUS.CREATE:
              backgroundLogger.debug(`收到来自标签页 ${tabId} 的连接请求`);
              port.postMessage({
                status: CONNECT_STATUS.CONNECT,
              });
              break;
            case CONNECT_STATUS.SLIDER_POSITION_REQUEST: {
              const { requestId, target_base64, background_base64 } = msg.message || {};
              if (requestId && target_base64 != null && background_base64 != null) {
                fetchSliderPositionPercentage({
                  target_base64,
                  background_base64,
                })
                  .then((result) => {
                    try {
                      port.postMessage({
                        status: CONNECT_STATUS.SLIDER_POSITION_RESPONSE,
                        message: { requestId, ...result },
                      });
                    } catch {
                      // port 已断开时忽略
                    }
                  })
                  .catch((err) => {
                    backgroundLogger.error('滑块 API 未捕获错误', err);
                    try {
                      port.postMessage({
                        status: CONNECT_STATUS.SLIDER_POSITION_RESPONSE,
                        message: {
                          requestId,
                          success: false,
                          error: err instanceof Error ? err.message : String(err),
                        },
                      });
                    } catch {}
                  });
              }
              break;
            }
            default:
              break;
          }
        });

        // 监听断开连接
        port.onDisconnect.addListener(() => {
          contentPorts.delete(tabId);
          backgroundLogger.info(`标签页 ${tabId} 连接已断开，当前连接数: ${contentPorts.size}`);
        });
      } else {
        backgroundLogger.warn('无法获取标签页 ID，连接将被忽略');
      }
    }
  });
  // 监听消息（滑块位置：port 为主，sendMessage 为兜底，确保 background 能收到请求）
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender?.tab?.id;
    if (message.type === XHR_PORT_NAME && tabId) {
      backgroundLogger.debug('Background 收到消息:', message.message);
      setLogger(LOGGER_LEVEL.ACTION, 'background', '收到xhr消息', message.message);
      setSellData(JSON.parse(message.message.responseData));
    } else if (message.type === SLIDER_POSITION_API) {
      const data = message.data as { target_base64: string; background_base64: string };
      if (data?.target_base64 != null && data?.background_base64 != null) {
        let responded = false;
        const once = (payload: { success: boolean; percentage?: number; error?: string }) => {
          if (responded) return;
          responded = true;
          try {
            sendResponse(payload);
          } catch {}
        };
        const timeoutId = setTimeout(
          () => once({ success: false, error: '滑块位置 API 请求超时' }),
          SLIDER_API_RESPONSE_TIMEOUT_MS
        );
        fetchSliderPositionPercentage(data)
          .then((result) => {
            clearTimeout(timeoutId);
            once(result);
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            once({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      return true;
    }
  });

  const SLIDER_API_RESPONSE_TIMEOUT_MS = 25000;

  /**
   * 请求滑块位置百分比。通过 port 使用，不依赖 sendMessage 的异步通道，避免“message channel closed”错误。
   */
  async function fetchSliderPositionPercentage(data: {
    target_base64: string;
    background_base64: string;
  }): Promise<{ success: boolean; percentage?: number; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SLIDER_API_RESPONSE_TIMEOUT_MS);

    try {
      const response = await fetch(
        'https://vpp.energy.cloud/api/vpp/image_process/get_slider_position_percentage',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_base64: data.target_base64,
            background_base64: data.background_base64,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      console.log(response);
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log(result);
      backgroundLogger.debug('Background API 返回数据:', result);

      const percentage = result.percentage ?? result.position ?? result ?? 0;
      if (typeof percentage !== 'number') {
        throw new Error(`无效的返回数据格式: ${JSON.stringify(result)}`);
      }
      return { success: true, percentage };
    } catch (error) {
      clearTimeout(timeoutId);
      backgroundLogger.error('Background 调用 API 失败:', error);
      const message = error instanceof Error ? error.message : String(error);
      const isAbort =
        typeof error === 'object' && error !== null && (error as any).name === 'AbortError';
      return {
        success: false,
        error: isAbort ? '滑块位置 API 请求超时' : message,
      };
    }
  }
  /**
   * 向所有连接的 content script 广播消息
   */
  function broadcastToAllContent(message: BackgroundConnectionMessage) {
    contentPorts.forEach((port, tabId) => {
      try {
        port.postMessage(message);
      } catch (err) {
        backgroundLogger.error(`向标签页 ${tabId} 发送消息失败:`, err);
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
        backgroundLogger.error(`向标签页 ${tabId} 发送消息失败:`, err);
        contentPorts.delete(tabId);
      }
    } else {
      backgroundLogger.warn(`标签页 ${tabId} 未连接`);
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
