import { EXECUTION_TYPE, TRADE_STATUS, XHR_PORT_NAME } from '@/constants';
import { FETCH_PORT_NAME } from '@/constants';
import { SCRIPT_LOGGER_PORT_NAME } from '@/constants';
import { receiveLoggerMessage } from '../log';
import { BACKGROUND_CONTENT_CONNECTION_NAME, CONNECT_STATUS } from '@/constants';
import { onUnmounted, ref } from 'vue';
import { logAction, logInfo } from '@/model/log';
import { contentLogger } from '@/utils/logger';
import {
  getChoiceSellData,
  getSellDataStatus,
  setChoiceSellData,
  setSellData,
  setSellDataStatus,
} from '@/model/sellData';
import { ElMessageBox } from 'element-plus';

export function useBackgroundConnection() {
  const backgroundConnection = chrome.runtime.connect({ name: BACKGROUND_CONTENT_CONNECTION_NAME });
  const tradeStatus = ref<string>(TRADE_STATUS.DISPLAY);
  const sellData = ref<SELL_DATA_ITEM[]>([]);
  const actualElectricityVolume = ref<number>(0);

  // 监听消息
  const onPortMessage = (msg: any) => {
    switch (msg.status) {
      case CONNECT_STATUS.CONNECT:
        contentLogger.info('background 连接成功');
        break;
      default:
        break;
    }
  };
  backgroundConnection.onMessage.addListener(onPortMessage);

  // 监听消息
  const onWindowMessage = async (event: MessageEvent<any>) => {
    if (event.source !== window || !event.data) {
      return;
    }

    const raw = event.data.message;
    const safeJsonParse = (value: unknown) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    switch (event.data.type) {
      // 从注入的content script 发送过来的XHR消息转发给background
      case XHR_PORT_NAME:
        if (event.data.message.status === 200) {
          sellData.value = JSON.parse(event.data.message.responseData);
        }

        chrome.runtime.sendMessage({
          type: XHR_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的Fetch消息转发给background
      case FETCH_PORT_NAME:
        if (event.data.message.status === 200) {
          sellData.value = JSON.parse(event.data.message.responseData);
        }
        chrome.runtime.sendMessage({
          type: FETCH_PORT_NAME,
          message: event.data.message,
        });
        break;
      // 从注入的content script 发送过来的日志消息转发给background
      case SCRIPT_LOGGER_PORT_NAME:
      case EXECUTION_TYPE.LOG_INFO:
        {
          const parsed = safeJsonParse(raw) as {
            level?: string;
            message?: string;
            data?: any;
          } | null;
          if (parsed?.level && parsed?.message) {
            receiveLoggerMessage(parsed.level, parsed.message, parsed.data ?? null);
          }
        }
        break;
      case EXECUTION_TYPE.GET_SELL_DATA:
        {
          const parsed = safeJsonParse(raw) as { data?: SELL_DATA_ITEM[] } | null;
          if (parsed?.data) {
            sellData.value = parsed.data;
          }
        }
        logInfo('content', '获取挂牌数据成功', sellData.value);
        setSellData(sellData.value);
        break;
      case EXECUTION_TYPE.NEXT_CHOICE: {
        const parsed = safeJsonParse(raw) as { id: number; elecVolume: number } | null;
        if (!parsed) break;
        const choiceSellData: CHOICE_SELL_DATA = await updateTradeData(parsed);
        logInfo('content', '完成选择', event.data.message);
        await ElMessageBox.confirm('确定 继续交易吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
        })
          .then(() => {
            window.postMessage(
              {
                type: EXECUTION_TYPE.TRADE,
                message: JSON.stringify(choiceSellData),
              },
              '*'
            );
          })
          .catch(() => {
            tradeStatus.value = TRADE_STATUS.CANCEL_TRADE;
            setSellDataStatus(tradeStatus.value);
            logAction('content', '异常停止，终止交易');
          });

        // 实际供电量在prevChoice中

        break;
      }
      case EXECUTION_TYPE.TRADE_END:
        tradeStatus.value = TRADE_STATUS.COMPLETE;
        {
          const parsed = safeJsonParse(raw) as { id: number; elecVolume: number } | null;
          if (parsed) updateTradeData(parsed);
        }
        setSellDataStatus(tradeStatus.value);
        logInfo('content', '交易结束');
        break;
      default:
        break;
    }
  };
  window.addEventListener('message', onWindowMessage);

  onUnmounted(() => {
    try {
      backgroundConnection.onMessage.removeListener(onPortMessage);
    } catch {}
    window.removeEventListener('message', onWindowMessage);
    try {
      backgroundConnection.disconnect();
    } catch {}
  });
  function sendMessageToBackground(message: BackgroundConnectionMessage) {
    if (backgroundConnection) {
      backgroundConnection.postMessage(message);
    }
  }

  function initIframe() {
    window.postMessage(
      {
        type: EXECUTION_TYPE.INITIFRAME,
      },
      '*'
    );
    getSellDataStatus().then(async (status: string | undefined) => {
      if (status) {
        tradeStatus.value = status;
      }
      if (status === TRADE_STATUS.TRADE) {
        await ElMessageBox.confirm('交易中，是否继续交易？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
        })
          .then((result) => {
            logAction('content', '交易中，继续交易');
            getChoiceSellData().then((data: CHOICE_SELL_DATA) => {
              actualElectricityVolume.value += data.prevChoice.reduce(
                (acc, curr) => acc + curr.elecVolume,
                0
              );
              window.postMessage(
                {
                  type: EXECUTION_TYPE.TRADE,
                  message: JSON.stringify(data),
                },
                '*'
              );
            });
          })
          .catch(() => {
            logAction('content', '交易中，终止交易');
            tradeStatus.value = TRADE_STATUS.DISPLAY;
            setSellDataStatus(tradeStatus.value);
          });
      }
    });
  }

  async function updateTradeData(data: { id: number; elecVolume: number }) {
    const choiceSellData: CHOICE_SELL_DATA = await getChoiceSellData();
    choiceSellData.prevChoice.push(data);
    actualElectricityVolume.value = choiceSellData.prevChoice.reduce(
      (acc, curr) => acc + curr.elecVolume,
      0
    );
    choiceSellData.currentChoice = choiceSellData.nextChoice[0];
    choiceSellData.nextChoice = choiceSellData.nextChoice.slice(1);
    setChoiceSellData(choiceSellData);
    return choiceSellData;
  }

  function tradeIframe(data: { id: number; elecVolume: number }[]) {
    tradeStatus.value = TRADE_STATUS.TRADE;
    setSellDataStatus(tradeStatus.value);
    const choiceSellData: CHOICE_SELL_DATA = {
      prevChoice: [],
      currentChoice: data[0],
      nextChoice: data.slice(1),
    };
    setChoiceSellData(choiceSellData);
    window.postMessage(
      {
        type: EXECUTION_TYPE.TRADE,
        message: JSON.stringify(choiceSellData),
      },
      '*'
    );
  }

  function cancelTradeIframe() {
    tradeStatus.value = TRADE_STATUS.CANCEL_TRADE;
    setSellDataStatus(tradeStatus.value);
    window.postMessage(
      {
        type: EXECUTION_TYPE.CANCEL_TRADE,
      },
      '*'
    );
  }

  function resetTradeIframe() {
    tradeStatus.value = TRADE_STATUS.DISPLAY;
    setSellDataStatus(tradeStatus.value);
  }

  async function continueTradeIframe() {
    tradeStatus.value = TRADE_STATUS.TRADE;
    setSellDataStatus(tradeStatus.value);
    const choiceSellData: CHOICE_SELL_DATA = await getChoiceSellData();
    window.postMessage(
      {
        type: EXECUTION_TYPE.TRADE,
        message: JSON.stringify(choiceSellData),
      },
      '*'
    );
  }
  return {
    sendMessageToBackground,
    initIframe,
    sellData,
    tradeStatus,
    tradeIframe,
    cancelTradeIframe,
    resetTradeIframe,
    actualElectricityVolume,
    continueTradeIframe,
  };
}
