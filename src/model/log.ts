import { LOGGER_NAME, LOGGER_LEVEL, DEFAULT_MAX_LOGS, EXECUTION_TYPE } from '@/constants';
import { backgroundLogger } from '@/utils/logger';

/**
 * 获取存储键名
 */
function getStorageKey(): string {
  return LOGGER_NAME;
}

/**
 * 初始化日志存储
 */
async function initLogStorage(): Promise<LogStorage> {
  return new Promise((resolve) => {
    chrome.storage.local.get([getStorageKey()], (result) => {
      const stored = result[getStorageKey()] as LogStorage | undefined;
      if (stored && Array.isArray(stored.logs)) {
        resolve({
          logs: stored.logs,
          maxLogs: stored.maxLogs || DEFAULT_MAX_LOGS,
        });
      } else {
        resolve({
          logs: [],
          maxLogs: DEFAULT_MAX_LOGS,
        });
      }
    });
  });
}

/**
 * 保存日志到存储
 */
async function saveLogs(logs: LogEntry[], maxLogs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // 限制日志数量，保留最新的日志
    const limitedLogs = logs.slice(-maxLogs);

    chrome.storage.local.set(
      {
        [getStorageKey()]: {
          logs: limitedLogs,
          maxLogs,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * 记录日志
 * @param level 日志级别
 * @param target 日志来源
 * @param message 日志消息
 * @param data 可选的额外数据
 */
export async function setLogger(
  level: string,
  target: string,
  message: string,
  data?: any
): Promise<void> {
  try {
    const storage = await initLogStorage();

    const logEntry: LogEntry = {
      level,
      target,
      message,
      timestamp: Date.now(),
      data,
    };

    // 追加新日志
    storage.logs.unshift(logEntry);

    // 保存日志
    await saveLogs(storage.logs, storage.maxLogs);
  } catch (error) {
    // 使用原生 console.error 避免循环调用
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Logger] 保存日志失败:', error);
    }
  }
}

/**
 * 获取所有日志
 * @param limit 限制返回的日志数量（可选，返回最新的 N 条）
 */
export async function getLogs(limit?: number): Promise<LogEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([getStorageKey()], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const stored = result[getStorageKey()] as LogStorage | undefined;
      if (stored && Array.isArray(stored.logs)) {
        const logs = limit ? stored.logs.slice(-limit) : stored.logs;
        resolve(logs);
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * 根据条件过滤日志
 * @param filter 过滤条件
 */
export async function getLogsByFilter(filter: {
  level?: string;
  target?: string;
  startTime?: number;
  endTime?: number;
}): Promise<LogEntry[]> {
  const allLogs = await getLogs();
  return allLogs.filter((log) => {
    if (filter.level && log.level !== filter.level) return false;
    if (filter.target && log.target !== filter.target) return false;
    if (filter.startTime && log.timestamp < filter.startTime) return false;
    if (filter.endTime && log.timestamp > filter.endTime) return false;
    return true;
  });
}

/**
 * 清空所有日志
 */
export async function clearLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([getStorageKey()], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * 设置最大日志数量
 * @param maxLogs 最大日志数量
 */
export async function setMaxLogs(maxLogs: number): Promise<void> {
  try {
    const storage = await initLogStorage();
    await saveLogs(storage.logs, maxLogs);
  } catch (error) {
    // 使用原生 console.error 避免循环调用
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Logger] 设置最大日志数量失败:', error);
    }
  }
}

/**
 * 便捷方法：记录错误日志
 */
export function logError(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.ERROR, target, message, data);
}

/**
 * 便捷方法：记录信息日志
 */
export function logInfo(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.INFO, target, message, data);
}

/**
 * 便捷方法：记录警告日志
 */
export function logWarn(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.WARN, target, message, data);
}

/**
 * 便捷方法：记录调试日志
 */
export function logDebug(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.DEBUG, target, message, data);
}

/**
 * 便捷方法：记录响应日志
 */
export function logResponse(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.RESPONSE, target, message, data);
}

/**
 * 便捷方法：记录操作日志
 */
export function logAction(target: string, message: string, data?: any): Promise<void> {
  return setLogger(LOGGER_LEVEL.ACTION, target, message, data);
}

export function mainLogInfo(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.INFO, message, data }),
    },
    '*'
  );
}

export function mainLogError(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.ERROR, message, data }),
    },
    '*'
  );
}

export function mainLogWarn(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.WARN, message, data }),
    },
    '*'
  );
}

export function mainLogDebug(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.DEBUG, message, data }),
    },
    '*'
  );
}

export function mainLogResponse(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.RESPONSE, message, data }),
    },
    '*'
  );
}

export function mainLogAction(message: string, data?: any) {
  window.postMessage(
    {
      type: EXECUTION_TYPE.LOG_INFO,
      message: JSON.stringify({ level: LOGGER_LEVEL.ACTION, message, data }),
    },
    '*'
  );
}
