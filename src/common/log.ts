import { LOGGER_LEVEL, LOGGER_TARGET, SCRIPT_LOGGER_PORT_NAME } from '@/constants';
import { DOMAIN } from '@/constants';
import { logAction, logResponse, logError, logDebug, logInfo, logWarn } from '@/model/log';
// 发送日志消息给content
export function sendLoggerMessage(level: string, message: any, data?: any) {
  window.postMessage(
    {
      type: SCRIPT_LOGGER_PORT_NAME,
      message: JSON.stringify({ level, message, data }),
    },
    DOMAIN
  );
}

// 接收日志消息并记录到本地
export function receiveLoggerMessage(level: string, message: any, data?: any) {
  switch (level) {
    case LOGGER_LEVEL.ACTION:
      logAction(LOGGER_TARGET.CONTENT, message, data);
      break;
    case LOGGER_LEVEL.RESPONSE:
      logResponse(LOGGER_TARGET.CONTENT, message, data);
      break;
    case LOGGER_LEVEL.ERROR:
      logError(LOGGER_TARGET.CONTENT, message, data);
      break;
    case LOGGER_LEVEL.DEBUG:
      logDebug(LOGGER_TARGET.CONTENT, message, data);
      break;
    case LOGGER_LEVEL.INFO:
      logInfo(LOGGER_TARGET.CONTENT, message, data);
      break;
    case LOGGER_LEVEL.WARN:
      logWarn(LOGGER_TARGET.CONTENT, message, data);
      break;
  }
}
