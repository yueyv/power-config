import { EXECUTION_TYPE } from '@/constants';
import { executeCaptchaClickFlow } from './slideValid';

/**
 * execution 运行在注入的 window 上下文，不能调用插件 API（如 chrome.storage）。
 * 仅使用 console 与 postMessage，由 content script 接收后再落存储。
 */
function execLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
  const payload = { level, message, data };
  if (level === 'error') console.error('[execution]', message, data);
  else if (level === 'warn') console.warn('[execution]', message, data);
  else if (level === 'debug') console.debug('[execution]', message, data);
  else console.log('[execution]', message, data);
  try {
    window.postMessage({ type: EXECUTION_TYPE.LOG_INFO, message: JSON.stringify(payload) }, '*');
  } catch {
    // postMessage 失败时不再上报，避免影响主流程
  }
}

function parseDateTimeToMs(input: string): number | null {
  const raw = input?.trim();
  if (!raw) return null;
  const normalized = raw.replace(/\//g, '-');
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? null : ms;
}

function computeAvailableAtMs(
  actionCountdownSeconds: number | undefined,
  xtdqsj: string
): number | undefined {
  if (actionCountdownSeconds !== undefined && Number.isFinite(actionCountdownSeconds)) {
    return Date.now() + Math.max(0, actionCountdownSeconds) * 1000;
  }
  const ms = parseDateTimeToMs(xtdqsj);
  return ms ?? undefined;
}

function parseActionCountdownSeconds(text: string): number | undefined {
  const raw = text.trim();
  if (!raw) return undefined;
  const onlyNum = raw.match(/^\d+$/);
  if (onlyNum) {
    const n = parseInt(onlyNum[0], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const secMatch = raw.match(/(\d+)\s*秒/);
  if (secMatch) {
    const n = parseInt(secMatch[1], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const minMatch = raw.match(/(\d+)\s*分/);
  const secAfterMin = raw.match(/(\d+)\s*秒/);
  if (minMatch || secAfterMin) {
    const m = minMatch ? parseInt(minMatch[1], 10) : 0;
    const s = secAfterMin ? parseInt(secAfterMin[1], 10) : 0;
    if (Number.isFinite(m) && Number.isFinite(s)) return m * 60 + s;
  }
  return undefined;
}

function simulateInput(input: HTMLInputElement | null, value: string | number): boolean {
  if (!input) {
    execLog('error', '模拟输入失败：输入框元素不存在');
    return false;
  }
  try {
    if (input.offsetParent === null) {
      execLog('warn', '输入框不可见，尝试滚动到元素位置');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    input.focus();
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: true, view: window }));
    input.value = '';
    const stringValue = String(value);
    input.value = stringValue;
    const events = [
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: stringValue,
      }),
      new Event('change', { bubbles: true, cancelable: true }),
    ];
    events.forEach((event) => {
      if (!input.dispatchEvent(event)) execLog('warn', `输入事件 ${event.type} 被阻止`);
    });
    const onchangeAttr = input.getAttribute('onchange');
    if (onchangeAttr) {
      const iframeEl = document.getElementsByClassName('body-iframe tabsr')?.[0] as
        | HTMLIFrameElement
        | undefined;
      const iframe = iframeEl?.contentWindow;
      if (iframe && typeof (iframe as any).eval === 'function') {
        try {
          (iframe as any).eval(onchangeAttr);
        } catch (error) {
          execLog('warn', '执行 onchange 属性失败', error);
        }
      }
    }
    execLog('info', `模拟输入成功：${stringValue}`, {
      inputId: input.id,
      inputName: input.name,
      inputType: input.type,
      value: input.value,
    });
    return true;
  } catch (error) {
    execLog('error', '模拟输入异常', error);
    return false;
  }
}

function simulateClick(element: HTMLElement | null): boolean {
  if (!element) {
    execLog('error', '模拟点击失败：元素不存在');
    return false;
  }
  try {
    if (element.offsetParent === null) {
      execLog('warn', '元素不可见，尝试滚动到元素位置');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (typeof (element as any).focus === 'function') (element as any).focus();
    const events = [
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 1,
      }),
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
    ];
    events.forEach((event) => {
      if (!element.dispatchEvent(event)) execLog('warn', `事件 ${event.type} 被阻止`);
    });
    const onclickAttr = element.getAttribute('onclick');
    if (onclickAttr) {
      try {
        const onclickMatch = onclickAttr.match(/^(\w+)\(([^)]*)\)/);
        if (onclickMatch) {
          const funcName = onclickMatch[1];
          const argsStr = onclickMatch[2];
          const args = argsStr
            ? argsStr.split(',').map((arg) => {
                const trimmed = arg.trim();
                const num = Number(trimmed);
                return isNaN(num) ? trimmed : num;
              })
            : [];
          const iframeEl = document.getElementsByClassName('body-iframe tabsr')?.[0] as
            | HTMLIFrameElement
            | undefined;
          const iframe = iframeEl?.contentWindow;
          if (iframe && typeof (iframe as any)[funcName] === 'function') {
            (iframe as any)[funcName](...args);
            execLog('info', `直接调用函数：${funcName}(${args.join(', ')})`);
          } else {
            execLog('warn', `函数 ${funcName} 在 iframe 中不存在`);
          }
        }
      } catch (error) {
        execLog('error', '执行 onclick 属性失败', error);
      }
    }
    if (typeof element.click === 'function') element.click();
    execLog('info', `模拟点击成功：${element.tagName}`, {
      onclick: onclickAttr,
      text: element.textContent?.trim(),
    });
    return true;
  } catch (error) {
    execLog('error', '模拟点击异常', error);
    return false;
  }
}

/**
 * 交易执行：管理 iframe 内表格状态与自动交易。
 */
export class TradeExecution {
  private iframe: Window | undefined = undefined;
  private iframeDocument: Document | undefined = undefined;
  private prevChoice: { id: number; elecVolume: number }[] = [];
  private nextChoice: { id: number; elecVolume: number }[] = [];
  private currentChoice: { id: number; elecVolume: number } = { id: 0, elecVolume: 0 };
  private isTrade = false;

  init(): void {
    const iframeEl = document.getElementsByClassName('body-iframe tabsr')?.[0] as
      | HTMLIFrameElement
      | undefined;
    this.iframe = iframeEl?.contentWindow ?? undefined;
    this.iframeDocument = this.iframe?.document;
  }

  get isReady(): boolean {
    return !!this.iframeDocument;
  }

  getMCGPTableData(): BUY_DATA_ITEM[] | null {
    const table = this.iframeDocument?.getElementById('mcgpxx');
    if (!table) return null;

    const thead = table.querySelector('thead');
    const headerRow = thead?.querySelector('tr');
    const headers: string[] = [];
    if (headerRow) {
      headerRow.querySelectorAll('th').forEach((th) => {
        const div = th.querySelector('.dataTables_sizing');
        if (div) headers.push(div.textContent?.trim() || '');
      });
    }

    const findIndexByHeader = (aliases: string[]) => {
      if (!headers.length) return -1;
      for (const alias of aliases) {
        const idx = headers.findIndex((h) => h && h.includes(alias));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const tbody = table.querySelector('tbody');
    if (!tbody) return [];

    const rows: BUY_DATA_ITEM[] = [];
    const trElements = tbody.querySelectorAll('tr');

    trElements.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 9) return;

      const getCellText = (aliases: string[], fallbackIndex: number) => {
        const idx = findIndexByHeader(aliases);
        const cell = idx >= 0 ? tds[idx] : tds[fallbackIndex];
        return cell?.textContent?.trim() || '';
      };

      const gpdl = parseFloat(getCellText(['挂牌电量'], 0) || '0');
      const sydl = parseFloat(getCellText(['剩余电量'], 1) || '0');
      const gpdj = parseFloat(getCellText(['挂牌价格'], 2) || '0');
      const dprice = parseFloat(getCellText(['D1曲线', 'D1'], 3) || '0');
      const xhprice = parseFloat(getCellText(['该曲线', '现货价值', '现货'], 4) || '0');
      const bfcj = getCellText(['部分成交'], 5) || '';
      const hybdsj = getCellText(['合约标的时间', '合同标的时间', '合约标的'], 6) || '';
      const zpsysj = getCellText(['摘牌系统时间', '系统时间'], 6) || '';
      const xtdqsj = getCellText(['系统订单时间', '到期时间', '订单到期时间', '倒计时'], 6) || '';

      const actionIndex =
        findIndexByHeader(['操作', '摘牌', '操作ID']) >= 0
          ? findIndexByHeader(['操作', '摘牌', '操作ID'])
          : Math.max(0, tds.length - 2);
      const actionCell = tds[actionIndex];
      const actionButton = actionCell?.querySelector('button');
      const actionOnclick = actionButton?.getAttribute('onclick') || '';
      const actionIDMatch = actionOnclick.match(/wyzp\((\d+)\)/);
      const actionID = actionIDMatch ? parseInt(actionIDMatch[1], 10) : 0;
      const actionText = (actionCell?.textContent ?? actionButton?.textContent ?? '').trim();
      const actionCountdownSeconds = parseActionCountdownSeconds(actionText);
      const availableAtMs = computeAvailableAtMs(actionCountdownSeconds, xtdqsj);

      const detailIndex =
        findIndexByHeader(['详情', '详情ID']) >= 0
          ? findIndexByHeader(['详情', '详情ID'])
          : Math.max(0, tds.length - 1);
      const detailButton = tds[detailIndex]?.querySelector('button');
      const detailOnclick = detailButton?.getAttribute('onclick') || '';
      const detailIDMatch = detailOnclick.match(/info\((\d+)/);
      const detailID = detailIDMatch ? parseInt(detailIDMatch[1], 10) : 0;

      rows.push({
        gpid: actionID || detailID,
        gpdl,
        sydl,
        gpdj,
        dprice,
        xhprice,
        bfcj: bfcj === '是' ? '是' : '否',
        hybdsj,
        zpsysj,
        xtdqsj,
        ...(actionCountdownSeconds !== undefined && { actionCountdownSeconds }),
        ...(availableAtMs !== undefined && { availableAtMs }),
      });
    });

    return rows;
  }

  cancelTrade(): void {
    this.isTrade = false;
  }

  setChoiceAndTrade(choiceSellData: CHOICE_SELL_DATA): void {
    this.isTrade = true;
    this.currentChoice = choiceSellData.currentChoice ?? { id: 0, elecVolume: 0 };
    this.prevChoice = choiceSellData.prevChoice ?? [];
    this.nextChoice = choiceSellData.nextChoice ?? [];
  }

  private async updateChoice(currentChoiceElement: HTMLTableRowElement | null): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!this.isTrade) return;

    let clickSuccess = false;
    if (this.iframe && typeof (this.iframe as any).wyzp === 'function') {
      try {
        (this.iframe as any).wyzp(this.currentChoice.id);
        clickSuccess = true;
        execLog('info', `买操作：iframe.wyzp(${this.currentChoice.id})`);
      } catch (error) {
        execLog('error', '执行 iframe.wyzp(id) 失败', error);
      }
    } else {
      execLog('warn', 'iframe 或 iframe.wyzp 不可用');
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    const input = this.iframeDocument?.getElementById('zpdl') as HTMLInputElement;
    await new Promise((resolve) => setTimeout(resolve, 1200));

    if (input && this.currentChoice.elecVolume > 0) {
      const inputSuccess = simulateInput(input, this.currentChoice.elecVolume);
      if (inputSuccess) {
        execLog('info', `输入电量：${this.currentChoice.elecVolume}`, {
          gpid: this.currentChoice.id,
          elecVolume: this.currentChoice.elecVolume,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        execLog('warn', '输入电量失败，但继续执行后续流程');
      }
    } else {
      execLog('warn', '未找到输入框或电量值为0', {
        inputExists: !!input,
        elecVolume: this.currentChoice.elecVolume,
      });
    }

    if (!clickSuccess) execLog('warn', '点击操作按钮失败，但继续执行后续流程');

    const ZPButton = this.iframeDocument?.getElementById('qdzp') as HTMLButtonElement;
    if (!simulateClick(ZPButton as HTMLElement)) {
      execLog('warn', '点击摘牌按钮失败，但继续执行后续流程');
    }

    execLog('debug', '当前选择状态', {
      currentChoice: this.currentChoice,
      prevChoice: this.prevChoice,
      nextChoice: this.nextChoice,
      isTrade: this.isTrade,
    });
    await executeCaptchaClickFlow();

    if (this.nextChoice.length <= 0) {
      window.postMessage(
        { type: EXECUTION_TYPE.TRADE_END, message: JSON.stringify(this.currentChoice) },
        '*'
      );
      execLog('info', '交易结束');
      return;
    }
    window.postMessage(
      { type: EXECUTION_TYPE.NEXT_CHOICE, message: JSON.stringify(this.currentChoice) },
      '*'
    );
  }

  async renderChoiceState(options?: { autoTrade?: boolean }): Promise<void> {
    const autoTrade = options?.autoTrade ?? true;
    const table = this.iframeDocument?.getElementById('mcgpxx');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    const trs = tbody.querySelectorAll('tr');
    let currentChoiceElement: HTMLTableRowElement | null = null;

    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i];
      const tds = tr.querySelectorAll('td');
      if (tds.length < 9) continue;
      const actionButton = tds[7].querySelector('button');
      const actionOnclick = actionButton?.getAttribute('onclick') || '';
      const actionIDMatch = actionOnclick.match(/wyzp\((\d+)\)/);
      const gpid = actionIDMatch ? parseInt(actionIDMatch[1], 10) : 0;
      if (gpid === this.currentChoice.id) {
        currentChoiceElement = tr as HTMLTableRowElement;
      }
    }

    if (currentChoiceElement) {
      currentChoiceElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (autoTrade) {
        await this.updateChoice(currentChoiceElement);
      }
    }
  }

  async tradeIframe(): Promise<void> {
    await this.renderChoiceState({ autoTrade: true });
  }
}

const tradeExecution = new TradeExecution();

export function getMCGPTableData(): BUY_DATA_ITEM[] | null {
  return tradeExecution.getMCGPTableData();
}

export async function tradeIframe(): Promise<void> {
  await tradeExecution.tradeIframe();
}

window.addEventListener('message', (event) => {
  switch (event.data.type) {
    case EXECUTION_TYPE.INITIFRAME:
      tradeExecution.init();
      if (tradeExecution.isReady) {
        execLog('info', '初始化iframe成功');
      } else {
        execLog('error', '初始化iframe失败');
      }
      const buyData = tradeExecution.getMCGPTableData();
      if (buyData) {
        execLog('info', '获取挂牌数据成功', buyData);
      } else {
        execLog('error', '获取挂牌数据失败');
      }
      window.postMessage(
        { type: EXECUTION_TYPE.GET_SELL_DATA, message: JSON.stringify({ data: buyData }) },
        '*'
      );
      break;

    case EXECUTION_TYPE.CANCEL_TRADE:
      tradeExecution.cancelTrade();
      execLog('info', '终止交易', event.data.message);
      break;

    case EXECUTION_TYPE.TRADE: {
      execLog('info', '交易', JSON.parse(event.data.message));
      const choiceSellData: CHOICE_SELL_DATA = JSON.parse(event.data.message);
      tradeExecution.setChoiceAndTrade(choiceSellData);
      void tradeExecution.tradeIframe();
      break;
    }

    case EXECUTION_TYPE.REQUEST_SELL_DATA: {
      const buyData = tradeExecution.getMCGPTableData();
      window.postMessage(
        { type: EXECUTION_TYPE.GET_SELL_DATA, message: JSON.stringify({ data: buyData }) },
        '*'
      );
      break;
    }
  }
});
