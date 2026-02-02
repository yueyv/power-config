/**
 * 统一的日志工具类
 * 提供统一的日志接口，支持日志级别控制、格式化输出和存储
 */

import { LOGGER_TARGET } from '@/constants';
import { logError, logInfo, logWarn, logDebug, logResponse, logAction } from '@/model/log';
import { sendLoggerMessage } from '@/common/log';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  RESPONSE = 'response',
  ACTION = 'action',
}

/**
 * 日志配置
 */
interface LoggerConfig {
  /** 是否启用控制台输出 */
  enableConsole?: boolean;
  /** 是否启用日志存储 */
  enableStorage?: boolean;
  /** 是否启用消息发送 */
  enableMessage?: boolean;
  /** 最小日志级别（低于此级别的日志将被忽略） */
  minLevel?: LogLevel;
  /** 日志来源 */
  target?: string;
}

/**
 * 默认配置
 */
const defaultConfig: Required<LoggerConfig> = {
  enableConsole: true,
  enableStorage: true,
  enableMessage: true,
  minLevel: LogLevel.DEBUG,
  target: LOGGER_TARGET.EXECUTION,
};

/**
 * 日志级别优先级
 */
const logLevelPriority: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.RESPONSE]: 1,
  [LogLevel.ACTION]: 1,
};

/**
 * 控制台样式配置
 */
const consoleStyles: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'color:#999;font-size:11px',
  [LogLevel.INFO]: 'color:#1890ff;font-weight:bold',
  [LogLevel.WARN]: 'color:#faad14;font-weight:bold',
  [LogLevel.ERROR]: 'color:#ff4d4f;font-weight:bold',
  [LogLevel.RESPONSE]: 'color:#52c41a;font-weight:bold',
  [LogLevel.ACTION]: 'color:#722ed1;font-weight:bold',
};

/**
 * 格式化日志消息
 */
function formatMessage(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data !== undefined) {
    try {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      return `${prefix} ${message}\n${dataStr}`;
    } catch {
      return `${prefix} ${message}\n[无法序列化数据]`;
    }
  }

  return `${prefix} ${message}`;
}

/**
 * 日志类
 */
class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    const currentPriority = logLevelPriority[level];
    const minPriority = logLevelPriority[this.config.minLevel];
    return currentPriority >= minPriority;
  }

  /**
   * 记录日志的核心方法
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = formatMessage(level, message, data);
    const style = consoleStyles[level];

    // 控制台输出
    if (this.config.enableConsole) {
      const consoleMethod = this.getConsoleMethod(level);
      if (data !== undefined) {
        consoleMethod(`%c${formattedMessage}`, style, data);
      } else {
        consoleMethod(`%c${formattedMessage}`, style);
      }
    }

    // 存储日志
    if (this.config.enableStorage) {
      this.storeLog(level, message, data);
    }

    // 发送消息
    if (this.config.enableMessage) {
      sendLoggerMessage(level, message, data);
    }
  }

  /**
   * 获取对应的控制台方法
   */
  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug || console.log;
      case LogLevel.INFO:
        return console.info || console.log;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * 存储日志
   */
  private async storeLog(level: LogLevel, message: string, data?: any): Promise<void> {
    try {
      const logMethod = this.getLogMethod(level);
      await logMethod(this.config.target, message, data);
    } catch (error) {
      // 避免日志存储失败导致无限循环
      if (this.config.enableConsole) {
        console.error('[Logger] 存储日志失败:', error);
      }
    }
  }

  /**
   * 获取对应的日志存储方法
   */
  private getLogMethod(level: LogLevel) {
    switch (level) {
      case LogLevel.DEBUG:
        return logDebug;
      case LogLevel.INFO:
        return logInfo;
      case LogLevel.WARN:
        return logWarn;
      case LogLevel.ERROR:
        return logError;
      case LogLevel.RESPONSE:
        return logResponse;
      case LogLevel.ACTION:
        return logAction;
      default:
        return logInfo;
    }
  }

  /**
   * 调试日志
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 信息日志
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 警告日志
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 错误日志
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 响应日志
   */
  response(message: string, data?: any): void {
    this.log(LogLevel.RESPONSE, message, data);
  }

  /**
   * 操作日志
   */
  action(message: string, data?: any): void {
    this.log(LogLevel.ACTION, message, data);
  }

  /**
   * 分组日志（用于控制台）
   */
  group(label: string, collapsed = false): void {
    if (this.config.enableConsole) {
      if (collapsed) {
        console.groupCollapsed(label);
      } else {
        console.group(label);
      }
    }
  }

  /**
   * 结束分组
   */
  groupEnd(): void {
    if (this.config.enableConsole) {
      console.groupEnd();
    }
  }

  /**
   * 表格日志
   */
  table(data: any): void {
    if (this.config.enableConsole) {
      console.table(data);
    }
  }
}

/**
 * 创建日志实例的工厂函数
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * 默认日志实例（用于 content script 和 execution）
 */
export const logger = createLogger({
  target: LOGGER_TARGET.EXECUTION,
});

/**
 * Background 日志实例
 */
export const backgroundLogger = createLogger({
  target: LOGGER_TARGET.BACKGROUND,
});

/**
 * Content 日志实例
 */
export const contentLogger = createLogger({
  target: LOGGER_TARGET.CONTENT,
});

/**
 * Popup 日志实例
 */
export const popupLogger = createLogger({
  target: LOGGER_TARGET.POPUP,
});

/**
 * 便捷导出：使用默认 logger
 */
export const { debug, info, warn, error, response, action, group, groupEnd, table } = logger;
