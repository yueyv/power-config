import { sendLoggerMessage } from '@/common';
import { sendFetchMessage } from '@/common/fetch';
import { LOGGER_LEVEL, TARGET_URLS } from '@/constants';
import { logger } from './logger';

/**
 * 解析响应数据
 */
async function parseResponse(response: Response): Promise<any> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await response.clone().text();
      return text ? JSON.parse(text) : null;
    } else {
      const text = await response.clone().text();
      return text || null;
    }
  } catch {
    try {
      const text = await response.clone().text();
      return text || null;
    } catch {
      return null;
    }
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
 * 解析请求体
 */
async function parseRequestBody(body: BodyInit | null | undefined): Promise<any> {
  if (!body) return null;

  try {
    if (typeof body === 'string') {
      return JSON.parse(body);
    } else if (body instanceof FormData) {
      const obj: Record<string, any> = {};
      body.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    } else if (body instanceof URLSearchParams) {
      const obj: Record<string, any> = {};
      body.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    } else if (body instanceof Blob || body instanceof ArrayBuffer) {
      return '[Blob/ArrayBuffer]';
    }
    return body;
  } catch {
    return body;
  }
}

/**
 * 注入 Fetch 拦截器
 * @param options 配置选项
 */
export function injectFetchInterceptor(options: FetchInterceptorOptions = {}): void {
  if ((window as any).__fetchInterceptorInjected) {
    logger.warn('Fetch 拦截器已注入，跳过重复注入');
    return;
  }

  const { targetUrls = TARGET_URLS, enableLog = true, onRequest, onResponse, onError } = options;

  (window as any).__fetchInterceptorInjected = true;

  if (enableLog) {
    logger.info('Fetch 拦截器已注入');
  }

  // 保存原始 fetch 方法
  const originalFetch = window.fetch;

  // 重写 fetch 方法
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();

    // 解析 URL
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // 解析请求方法
    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    logger.debug('Fetch 请求:', { method, url });

    // 检查是否是目标 URL
    if (isTargetUrl(url, targetUrls)) {
      // 解析请求体
      const requestBody = await parseRequestBody(
        init?.body || (input instanceof Request ? input.body : null)
      );

      // 触发请求回调
      if (onRequest) {
        try {
          onRequest(method, url, requestBody);
        } catch (error) {
          logger.error('onRequest 回调执行失败:', error);
        }
      }

      try {
        // 调用原始 fetch
        const response = await originalFetch.apply(this, arguments as any);
        const duration = Date.now() - startTime;

        // 解析响应数据
        const responseData = await parseResponse(response);
        const status = response.status;

        if (enableLog) {
          logger.group(`[Fetch Response] ${method} ${url}`);
          logger.response('状态码:', status);
          logger.response('响应数据:', responseData);
          logger.response('耗时:', duration + 'ms');
          logger.groupEnd();
        }

        // 发送消息
        sendFetchMessage({
          url,
          status,
          responseData,
          duration,
        });

        // 触发响应回调
        if (onResponse) {
        try {
          onResponse(method, url, responseData, status);
        } catch (error) {
          logger.error('onResponse 回调执行失败:', error);
        }
        }

        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(`Fetch 请求失败: ${method} ${url}`);

        if (enableLog) {
          logger.error(`[Fetch Error] ${method} ${url}`, err);
        }

        // 触发错误回调
        if (onError) {
          try {
            onError(method, url, err);
          } catch (err) {
            logger.error('onError 回调执行失败:', err);
          }
        }

        throw error;
      }
    }

    // 非目标 URL，直接调用原始 fetch
    return originalFetch.apply(this, arguments as any);
  };
}

/**
 * 移除 Fetch 拦截器（恢复原始方法）
 */
export function removeFetchInterceptor(): void {
  if (!(window as any).__fetchInterceptorInjected) {
    logger.warn('Fetch 拦截器未注入，无需移除');
    return;
  }

  // 注意：由于无法完全恢复原始 fetch，这里只移除标记
  delete (window as any).__fetchInterceptorInjected;
  logger.info('Fetch 拦截器标记已移除（注意：原始方法无法完全恢复）');
}

if (typeof window !== 'undefined') {
  // 在浏览器环境中自动注入
  injectFetchInterceptor({
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
