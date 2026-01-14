export const IGNORE_TYPES = ['image', 'stylesheet', 'font', 'script'];
export const IGNORE_INITIATORS = ['https://developer.chrome.google.cn'];
export const TARGET_URLS = ['/zcq/scgpjy/jysb.do?method=getAllSellAndBuyData'];
export const XHR_PORT_NAME = 'xhr-inject';
export const SCRIPT_LOGGER_PORT_NAME = 'xhr-logger';
export const FETCH_PORT_NAME = 'fetch-inject';
export const LOGGER_NAME = 'logger';
export const BACKGROUND_CONTENT_CONNECTION_NAME = 'background-content-connection';
export const LOGGER_LEVEL = {
  ACTION: 'action',
  RESPONSE: 'response',
  ERROR: 'error',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
};
export const CONNECT_STATUS = {
  CREATE: 'create',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  CLICK_EVENT: 'click-event',
};

export const LOGGER_TARGET = {
  BACKGROUND: 'background',
  CONTENT: 'content',
  POPUP: 'popup',
};

// 开发环境使用*，生产环境使用具体域名
export const DOMAIN = '*';
/**
 * 默认最大日志数量
 */
export const DEFAULT_MAX_LOGS = 1000;
