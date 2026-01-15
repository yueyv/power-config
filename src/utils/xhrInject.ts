import { sendLoggerMessage } from '@/common';
import { sendXHRMessage } from '@/common/xhr';
import { LOGGER_LEVEL, TARGET_URLS } from '@/constants';
/**
 * 解析响应数据
 */
function parseResponse(responseText: string): any {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

/**
 * 检查 URL 是否匹配目标路径
 */
function isTargetUrl(url: string, targetUrls: string[]): boolean {
  if (!url || !targetUrls.length) return false;
  return targetUrls.some((targetUrl) => url.includes(targetUrl));
}

/**
 * 注入 XMLHttpRequest 拦截器
 * @param options 配置选项
 */
export function injectXHRInterceptor(options: XHRInterceptorOptions = {}): void {
  if ((XMLHttpRequest.prototype as any).__xhrInterceptorInjected) {
    console.warn('XMLHttpRequest 拦截器已注入，跳过重复注入');
    return;
  }

  const { targetUrls = TARGET_URLS, enableLog = true, onRequest, onResponse, onError } = options;

  (XMLHttpRequest.prototype as any).__xhrInterceptorInjected = true;

  if (enableLog) {
    console.log(
      '%c>>>>> XMLHttpRequest 拦截器已注入',
      'color:yellow;background:red;padding:2px 4px'
    );
  }

  // 保存原始方法
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  // 重写 open 方法
  XMLHttpRequest.prototype.open = function (
    this: ExtendedXMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    // 将 URL 对象转换为字符串
    const urlString = typeof url === 'string' ? url : url.toString();

    // 记录请求信息
    this._method = method.toUpperCase();
    this._url = urlString;
    this._startTime = Date.now();

    // 调用原始方法
    return originalOpen.apply(this, arguments as any);
  };

  // 重写 send 方法
  XMLHttpRequest.prototype.send = function (
    this: ExtendedXMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const method = this._method || 'UNKNOWN';
    const url = this._url || 'UNKNOWN';
    console.log('xhr url', url);
    // 检查是否是目标 URL
    if (isTargetUrl(url, targetUrls)) {
      // 触发请求回调
      if (onRequest) {
        try {
          onRequest(method, url);
        } catch (error) {
          console.error('onRequest 回调执行失败:', error);
        }
      }

      // 监听响应完成事件
      this.addEventListener('load', function (this: ExtendedXMLHttpRequest) {
        // const duration = this._startTime ? Date.now() - this._startTime : 0;
        const status = this.status;
        const responseText = this.responseText;
        const responseData = parseResponse(responseText);

        if (enableLog) {
          console.group(`%c[XHR Response] ${method} ${url}`, 'color:green;font-weight:bold');
          console.log('状态码:', status);
          console.log('响应数据:', responseData);
          console.groupEnd();
        }
        sendXHRMessage({
          url,
          status,
          responseData,
        });
        // 触发响应回调
        if (onResponse) {
          try {
            onResponse(method, url, responseData, status);
          } catch (error) {
            console.error('onResponse 回调执行失败:', error);
          }
        }
      });

      // 监听错误事件
      this.addEventListener('error', function (this: ExtendedXMLHttpRequest) {
        const error = new Error(`XHR 请求失败: ${method} ${url}`);

        if (enableLog) {
          console.error(`%c[XHR Error] ${method} ${url}`, 'color:red;font-weight:bold', error);
        }

        // 触发错误回调
        if (onError) {
          try {
            onError(method, url, error);
          } catch (err) {
            console.error('onError 回调执行失败:', err);
          }
        }
      });

      // 监听超时事件
      this.addEventListener('timeout', function (this: ExtendedXMLHttpRequest) {
        const error = new Error(`XHR 请求超时: ${method} ${url}`);

        if (enableLog) {
          console.warn(`%c[XHR Timeout] ${method} ${url}`, 'color:orange;font-weight:bold', error);
        }

        // 触发错误回调
        if (onError) {
          try {
            onError(method, url, error);
          } catch (err) {
            console.error('onError 回调执行失败:', err);
          }
        }
      });
    }

    // 调用原始方法
    return originalSend.apply(this, arguments as any);
  };
}

/**
 * 移除 XMLHttpRequest 拦截器（恢复原始方法）
 */
export function removeXHRInterceptor(): void {
  if (!(XMLHttpRequest.prototype as any).__xhrInterceptorInjected) {
    console.warn('XMLHttpRequest 拦截器未注入，无需移除');
    return;
  }

  delete (XMLHttpRequest.prototype as any).__xhrInterceptorInjected;
  console.log('XMLHttpRequest 拦截器标记已移除（注意：原始方法无法完全恢复）');
}

if (typeof window !== 'undefined') {
  // 在浏览器环境中自动注入
  injectXHRInterceptor({
    targetUrls: TARGET_URLS,
    enableLog: true,
    onRequest: (method, url) => {
      sendLoggerMessage(LOGGER_LEVEL.ACTION, `发起请求 ${method} ${url}`);
    },
    onResponse: (method, url, response, status) => {
      sendLoggerMessage(LOGGER_LEVEL.RESPONSE, `收到响应 ${method} ${url} ${status}`);
    },
    onError: (method, url, error) => {
      sendLoggerMessage(LOGGER_LEVEL.ERROR, `错误 ${method} ${url} ${error.message}`, error);
    },
  });
}
