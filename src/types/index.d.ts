/**
 * XMLHttpRequest 拦截器配置选项
 */
interface XHRInterceptorOptions {
  /** 需要拦截的 URL 路径列表 */
  targetUrls?: string[];
  /** 是否启用日志输出 */
  enableLog?: boolean;
  /** 自定义日志回调函数 */
  onRequest?: (method: string, url: string) => void;
  /** 自定义响应回调函数 */
  onResponse?: (method: string, url: string, response: any, status: number) => void;
  /** 错误回调函数 */
  onError?: (method: string, url: string, error: Error) => void;
}

/**
 * Fetch 拦截器配置选项
 */
interface FetchInterceptorOptions {
  /** 需要拦截的 URL 路径列表 */
  targetUrls?: string[];
  /** 是否启用日志输出 */
  enableLog?: boolean;
  /** 自定义日志回调函数 */
  onRequest?: (method: string, url: string, body?: any) => void;
  /** 自定义响应回调函数 */
  onResponse?: (method: string, url: string, response: any, status: number) => void;
  /** 错误回调函数 */
  onError?: (method: string, url: string, error: Error) => void;
}

/**
 * 扩展 XMLHttpRequest 接口，添加自定义属性
 */
interface ExtendedXMLHttpRequest extends XMLHttpRequest {
  _method?: string;
  _url?: string;
  _startTime?: number;
}

/**
 * 日志存储结构
 */
interface LogStorage {
  logs: LogEntry[];
  maxLogs: number; // 最大日志数量
}

interface LogEntry {
  /** 日志级别 */
  level: string;
  /** 日志来源（background/content/popup） */
  target: string;
  /** 日志消息 */
  message: string;
  /** 时间戳 */
  timestamp: number;
  /** 可选的额外数据 */
  data?: any;
}

/**
 * 静态资源文件模块声明
 */
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

interface BackgroundConnectionMessage {
  status: string;
  message?: any;
}
