import { EXECUTION_TYPE, SLIDER_POSITION_API, TRADE_STATUS, XHR_PORT_NAME } from '@/constants';
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
import { getTimeLeftMs } from '@/utils/tradePriority';
import { ElMessageBox } from 'element-plus';

/** 按挂牌价格 + 倒计时排序（与 TradeViewer 选中后顺序一致）：价格升序，同价则无倒计时在前、再按剩余时间升序 */
function sortChoiceItemsByPriceAndCountdown(
  items: { id: number; elecVolume: number }[],
  sellDataList: SELL_DATA_ITEM[]
): { id: number; elecVolume: number }[] {
  return [...items].sort((a, b) => {
    const itemA = sellDataList.find((r) => r.gpid === a.id);
    const itemB = sellDataList.find((r) => r.gpid === b.id);
    const pa = itemA?.gpdj ?? 0;
    const pb = itemB?.gpdj ?? 0;
    if (pa !== pb) return pa - pb;
    const ta = itemA ? getTimeLeftMs(itemA) : null;
    const tb = itemB ? getTimeLeftMs(itemB) : null;
    if (ta === null && tb === null) return 0;
    if (ta === null) return -1;
    if (tb === null) return 1;
    return ta - tb;
  });
}

export type UseBackgroundConnectionOptions = {
  /** 下一步交易时若下一笔有倒计时，先显示等待弹窗；返回 Promise<true> 表示用户取消，false 表示可继续 */
  showWaitCountdown?: (getCurrentMs: () => number | null) => Promise<boolean>;
};

export function useBackgroundConnection(options?: UseBackgroundConnectionOptions) {
  const backgroundConnection = chrome.runtime.connect({ name: BACKGROUND_CONTENT_CONNECTION_NAME });
  const tradeStatus = ref<string>(TRADE_STATUS.DISPLAY);
  const sellData = ref<SELL_DATA_ITEM[]>([]);
  const actualElectricityVolume = ref<number>(0);
  const showWaitCountdown = options?.showWaitCountdown;

  // 监听消息（含 port 返回的滑块位置结果，避免 sendMessage 通道关闭问题）
  const onPortMessage = (msg: any) => {
    switch (msg.status) {
      case CONNECT_STATUS.CONNECT:
        contentLogger.info('background 连接成功');
        break;
      case CONNECT_STATUS.SLIDER_POSITION_RESPONSE: {
        const payload = msg.message;
        if (payload?.requestId) {
          window.postMessage(
            {
              type: EXECUTION_TYPE.SLIDER_POSITION_RESPONSE,
              message: JSON.stringify({
                requestId: payload.requestId,
                success: payload.success ?? false,
                percentage: payload.percentage,
                error: payload.error,
              }),
            },
            '*'
          );
        }
        break;
      }
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
        // todo
        return;
        const proceed = await ElMessageBox.confirm('确定 继续交易吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
        })
          .then(() => true)
          .catch(() => false);
        if (!proceed) {
          tradeStatus.value = TRADE_STATUS.CANCEL_TRADE;
          setSellDataStatus(tradeStatus.value);
          logAction('content', '异常停止，终止交易');
          break;
        }
        // 下一步交易：统一走倒计时检查后再发送
        await sendTradeWithCountdownCheck(choiceSellData);
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
      case EXECUTION_TYPE.SLIDER_POSITION_REQUEST: {
        const parsed = safeJsonParse(raw) as {
          requestId?: string;
          targetBase64?: string;
          backgroundBase64?: string;
        } | null;
        if (!parsed?.requestId || parsed.targetBase64 == null || parsed.backgroundBase64 == null)
          break;
        const requestId = parsed.requestId;
        // 同时走 port 与 sendMessage：port 可能未建立导致 background 收不到，sendMessage 保证能发起请求
        backgroundConnection.postMessage({
          status: CONNECT_STATUS.SLIDER_POSITION_REQUEST,
          message: {
            requestId,
            target_base64: parsed.targetBase64,
            background_base64: parsed.backgroundBase64,
          },
        });
        chrome.runtime.sendMessage(
          {
            type: SLIDER_POSITION_API,
            data: {
              target_base64: parsed.targetBase64,
              background_base64: parsed.backgroundBase64,
            },
          },
          (response: { success?: boolean; percentage?: number; error?: string } | undefined) => {
            if (chrome.runtime.lastError && response === undefined) return;
            window.postMessage(
              {
                type: EXECUTION_TYPE.SLIDER_POSITION_RESPONSE,
                message: JSON.stringify({
                  requestId,
                  success: response?.success ?? false,
                  percentage: response?.percentage,
                  error: response?.error,
                }),
              },
              '*'
            );
          }
        );
        break;
      }
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
          .then(async (result) => {
            logAction('content', '交易中，继续交易');
            const data: CHOICE_SELL_DATA = await getChoiceSellData();
            actualElectricityVolume.value += data.prevChoice.reduce(
              (acc, curr) => acc + curr.elecVolume,
              0
            );
            tradeStatus.value = TRADE_STATUS.TRADE;
            setSellDataStatus(tradeStatus.value);
            // 恢复交易时也考虑当前笔的倒计时
            await sendTradeWithCountdownCheck(data);
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
    // 剩余队列按挂牌价格与倒计时重新排序（与选中后交易顺序一致）
    const pending = [choiceSellData.currentChoice, ...choiceSellData.nextChoice].filter(
      (x): x is { id: number; elecVolume: number } => x != null
    );
    if (pending.length > 0) {
      const sorted = sortChoiceItemsByPriceAndCountdown(pending, sellData.value);
      choiceSellData.currentChoice = sorted[0];
      choiceSellData.nextChoice = sorted.slice(1);
    }
    setChoiceSellData(choiceSellData);
    return choiceSellData;
  }

  /**
   * 统一「带倒计时检查的发送交易」：若当前要交易的 currentChoice 有倒计时且 showWaitCountdown 可用，
   * 先等待倒计时（或用户取消），再发送 TRADE。用于：继续交易、init 恢复交易、下一步交易。
   */
  async function sendTradeWithCountdownCheck(choiceSellData: CHOICE_SELL_DATA): Promise<void> {
    const current = choiceSellData.currentChoice;
    if (current && showWaitCountdown) {
      const getCurrentMs = () => {
        const item = sellData.value.find((r) => r.gpid === current.id);
        return item ? getTimeLeftMs(item) : null;
      };
      const ms = getCurrentMs();
      if (ms !== null && ms > 0) {
        const cancelled = await showWaitCountdown(getCurrentMs);
        if (cancelled) {
          tradeStatus.value = TRADE_STATUS.CANCEL_TRADE;
          setSellDataStatus(tradeStatus.value);
          logAction('content', '等待倒计时取消，终止交易');
          return;
        }
      }
    }
    window.postMessage(
      {
        type: EXECUTION_TYPE.TRADE,
        message: JSON.stringify(choiceSellData),
      },
      '*'
    );
  }

  function tradeIframe(data: { id: number; elecVolume: number }[]) {
    tradeStatus.value = TRADE_STATUS.TRADE;
    setSellDataStatus(tradeStatus.value);
    const sorted = sortChoiceItemsByPriceAndCountdown(data, sellData.value);
    const choiceSellData: CHOICE_SELL_DATA = {
      prevChoice: [],
      currentChoice: sorted[0],
      nextChoice: sorted.slice(1),
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
    // 重新交易时也考虑当前笔的倒计时，等待可摘牌后再发送
    await sendTradeWithCountdownCheck(choiceSellData);
  }

  /** 向 execution 请求同步最新挂牌数据（重新解析 iframe 表格并回传 GET_SELL_DATA） */
  function requestSyncSellData() {
    window.postMessage({ type: EXECUTION_TYPE.REQUEST_SELL_DATA }, '*');
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
    requestSyncSellData,
  };
}
