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

interface BUY_DATA_ITEM {
  // 唯一id
  gpid: number;
  // 挂牌电量
  gpdl: number;
  // 剩余电量
  sydl: number;
  // D1曲线电量
  dprice: number;
  // 部分成交
  bfcj: '是' | '否';
  // 现货价格
  xhprice: number;
  // 挂牌价格
  gpdj: number;
  // 摘牌系统时间
  zpsysj?: string;
  // 合同标的时间
  hybdsj?: string;
  // 系统订单时间
  xtdqsj?: string;
  /** 操作列显示的「N秒后可摘牌」中的秒数，用于倒计时排序 */
  actionCountdownSeconds?: number;
  /** 可摘牌/到期时间戳（毫秒），DOM 解析时写入；展示时 剩余 = availableAtMs - Date.now() */
  availableAtMs?: number;
}

interface CHOICE_SELL_DATA {
  prevChoice: { id: number; elecVolume: number }[];
  currentChoice: { id: number; elecVolume: number };
  nextChoice: { id: number; elecVolume: number }[];
}

interface SELL_DATA_ITEM {
  gpdl: number;
  dprice: number;
  gpid: number;
  bfcj: '是' | '否';
  hybdsj: string;
  xtdqsj: string;
  sydl: number;
  xhprice: number;
  zpsysj: string;
  gpdj: number;
  /** 操作列「N秒后可摘牌」的秒数，用于倒计时 */
  actionCountdownSeconds?: number;
  /** 可摘牌/到期时间戳（毫秒），解析时写入；展示时 剩余 = availableAtMs - Date.now() */
  availableAtMs?: number;
}
interface MCGPTableRow {
  挂牌电量: number;
  剩余电量: number;
  挂牌价格: number;
  D1曲线现货价值估算值: number;
  该曲线现货价值估算值: number;
  部分成交: string;
  合约标的时间: string;
  操作ID: number;
  详情ID: number;
}
