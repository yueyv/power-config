import {
  LOGGER_LEVEL,
  LOGGER_TARGET,
  XHR_LOGGER_PORT_NAME,
  XHR_PORT_NAME,
  FETCH_PORT_NAME,
} from '@/constants';
import { DOMAIN } from '@/constants';
import { logAction, logResponse, logError, logDebug, logInfo, logWarn } from '@/model/log';

export function sendXHRMessage(message: any) {
  window.postMessage(
    {
      type: XHR_PORT_NAME,
      message,
    },
    DOMAIN
  );
}

export function sendFetchMessage(message: any) {
  window.postMessage(
    {
      type: FETCH_PORT_NAME,
      message,
    },
    DOMAIN
  );
}

export function sendLoggerMessage(level: string, message: any, data?: any) {
  window.postMessage(
    {
      type: XHR_LOGGER_PORT_NAME,
      message: JSON.stringify({ level, message, data }),
    },
    DOMAIN
  );
}

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

export function handleMessage() {
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data) {
      return;
    }
    switch (event.data.type) {
      case XHR_PORT_NAME:
        chrome.runtime.sendMessage({
          type: XHR_PORT_NAME,
          message: event.data.message,
        });
        break;
      case FETCH_PORT_NAME:
        chrome.runtime.sendMessage({
          type: FETCH_PORT_NAME,
          message: event.data.message,
        });
        break;
      case XHR_LOGGER_PORT_NAME:
        receiveLoggerMessage(
          JSON.parse(event.data.message).level,
          JSON.parse(event.data.message).message,
          JSON.parse(event.data.message)?.data || null
        );
        break;
      default:
        break;
    }
  });
}
