import { DOMAIN, FETCH_PORT_NAME } from '@/constants';

export function sendFetchMessage(message: any) {
  window.postMessage(
    {
      type: FETCH_PORT_NAME,
      message,
    },
    DOMAIN
  );
}
