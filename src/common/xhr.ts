import { DOMAIN, XHR_PORT_NAME } from '@/constants';

export function sendXHRMessage(message: any) {
  window.postMessage(
    {
      type: XHR_PORT_NAME,
      message,
    },
    DOMAIN
  );
}
