import { EXECUTION_TYPE } from '@/constants';
import { mainLogError, mainLogInfo, mainLogWarn } from '@/model/log';
import { executeCaptchaClickFlow } from './slideValid';
import { logger } from './logger';
let iframe: Window | undefined = undefined;
let iframeDocument: Document | undefined = undefined;
let prevChoice: { id: number; elecVolume: number }[] = [];
let nextChoice: { id: number; elecVolume: number }[] = [];
let currentChoice: { id: number; elecVolume: number } = { id: 0, elecVolume: 0 };
let isTrade = false;
function init() {
  // @ts-ignore
  iframe = document.getElementsByClassName('body-iframe')?.[0].contentWindow;
  iframeDocument = iframe?.document;

  // 检查样式是否已经注入
  const existingStyle = iframeDocument?.getElementById('trade-choice-styles');
  if (existingStyle) {
    return; // 样式已存在，无需重复注入
  }

  // 创建样式元素
  const style = iframeDocument!.createElement('style');
  style.id = 'trade-choice-styles';
  style.textContent = `
    .current-choice {
      background-color:rgb(166, 202, 255) !important;
    }
    .next-choice {
      background-color: #ffc4c4 !important;
    }
    .prev-choice {
      background-color:rgb(180, 249, 168) !important;
    }
  `;
  // 将样式注入到 iframe 的 head 中
  const head = iframeDocument?.head || iframeDocument?.getElementsByTagName('head')[0];
  if (head) {
    head.appendChild(style);
    mainLogInfo('样式注入成功');
  } else {
    mainLogError('无法找到iframe的head元素');
  }
}

export function getMCGPTableData(): BUY_DATA_ITEM[] | null {
  const table = iframeDocument?.getElementById('mcgpxx');
  if (!table) {
    return null;
  }

  // 获取表头列名
  const thead = table.querySelector('thead');
  const headerRow = thead?.querySelector('tr');
  const headers: string[] = [];
  if (headerRow) {
    const thElements = headerRow.querySelectorAll('th');
    thElements.forEach((th) => {
      const div = th.querySelector('.dataTables_sizing');
      if (div) {
        headers.push(div.textContent?.trim() || '');
      }
    });
  }

  // 获取tbody中的所有行
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return [];
  }

  const rows: BUY_DATA_ITEM[] | null = [];
  const trElements = tbody.querySelectorAll('tr');

  trElements.forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 9) {
      return; // 跳过不完整的行
    }

    // 提取数据
    const gpdl = parseFloat(tds[0].textContent?.trim() || '0');
    const sydl = parseFloat(tds[1].textContent?.trim() || '0');
    const gpdj = parseFloat(tds[2].textContent?.trim() || '0');
    const dprice = parseFloat(tds[3].textContent?.trim() || '0');
    const xhprice = parseFloat(tds[4].textContent?.trim() || '0');
    const bfcj = tds[5].textContent?.trim() || '';
    const hybdsj = tds[6].textContent?.trim() || '';

    // 从操作按钮中提取ID
    const actionButton = tds[7].querySelector('button');
    const actionOnclick = actionButton?.getAttribute('onclick') || '';
    const actionIDMatch = actionOnclick.match(/wyzp\((\d+)\)/);
    const actionID = actionIDMatch ? parseInt(actionIDMatch[1], 10) : 0;

    // 从详情按钮中提取ID
    const detailButton = tds[8].querySelector('button');
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
    });
  });

  return rows;
}

/**
 * 模拟真实的输入操作
 * 注意：由于浏览器安全策略，isTrusted 属性始终为 false，无法绕过
 * @param input 输入框元素
 * @param value 要输入的值
 * @returns 是否成功输入
 */
function simulateInput(input: HTMLInputElement | null, value: string | number): boolean {
  if (!input) {
    mainLogError('模拟输入失败：输入框元素不存在');
    return false;
  }

  try {
    // 确保输入框可见和可交互
    if (input.offsetParent === null) {
      mainLogWarn('输入框不可见，尝试滚动到元素位置');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 等待滚动完成
      return false;
    }

    // 聚焦输入框
    input.focus();

    // 触发 focus 事件
    input.dispatchEvent(
      new FocusEvent('focus', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );

    // 清空现有值
    input.value = '';

    // 设置新值
    const stringValue = String(value);
    input.value = stringValue;

    // 触发完整的输入事件序列
    const events = [
      // input 事件（现代浏览器主要使用这个）
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: stringValue,
      }),
      // change 事件（值改变时触发）
      new Event('change', {
        bubbles: true,
        cancelable: true,
      }),
    ];

    // 依次触发事件
    events.forEach((event) => {
      const defaultPrevented = !input.dispatchEvent(event);
      if (defaultPrevented) {
        mainLogWarn(`输入事件 ${event.type} 被阻止`);
      }
    });

    // 如果输入框有 onchange 或 oninput 属性，尝试直接设置并触发
    const onchangeAttr = input.getAttribute('onchange');
    if (onchangeAttr && iframe) {
      try {
        // 在 iframe 的上下文中执行 onchange
        if (typeof (iframe as any).eval === 'function') {
          (iframe as any).eval(onchangeAttr);
        }
      } catch (error) {
        mainLogWarn('执行 onchange 属性失败', error);
      }
    }

    mainLogInfo(`模拟输入成功：${stringValue}`, {
      inputId: input.id,
      inputName: input.name,
      inputType: input.type,
      value: input.value,
    });

    return true;
  } catch (error) {
    mainLogError('模拟输入异常', error);
    return false;
  }
}

/**
 * 模拟真实的鼠标点击事件
 * 注意：由于浏览器安全策略，isTrusted 属性始终为 false，无法绕过
 * @param element 要点击的元素
 * @returns 是否成功触发点击
 */
function simulateClick(element: HTMLElement | null): boolean {
  if (!element) {
    mainLogError('模拟点击失败：元素不存在');
    return false;
  }

  try {
    // 确保元素可见和可交互
    if (element.offsetParent === null) {
      mainLogWarn('元素不可见，尝试滚动到元素位置');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 等待滚动完成
      return false;
    }

    // 聚焦元素（如果可聚焦）
    if (typeof (element as any).focus === 'function') {
      (element as any).focus();
    }

    // 创建完整的鼠标事件序列，模拟真实用户交互
    const events = [
      // mousedown 事件
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0, // 左键
        buttons: 1,
      }),
      // mouseup 事件
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
      // click 事件
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        buttons: 0,
      }),
    ];

    // 依次触发事件
    events.forEach((event) => {
      const defaultPrevented = !element.dispatchEvent(event);
      if (defaultPrevented) {
        mainLogWarn(`事件 ${event.type} 被阻止`);
      }
    });

    // 如果元素有 onclick 属性，尝试直接执行函数调用
    const onclickAttr = element.getAttribute('onclick');
    if (onclickAttr && iframe) {
      try {
        // 提取函数名和参数（例如：wyzp(123)）
        const onclickMatch = onclickAttr.match(/^(\w+)\(([^)]*)\)/);
        if (onclickMatch) {
          const funcName = onclickMatch[1];
          const argsStr = onclickMatch[2];

          // 解析参数（支持数字和字符串）
          const args = argsStr
            ? argsStr.split(',').map((arg) => {
                const trimmed = arg.trim();
                // 尝试解析为数字
                const num = Number(trimmed);
                return isNaN(num) ? trimmed : num;
              })
            : [];

          // 在 iframe 的 window 对象上查找并调用函数
          if (typeof (iframe as any)[funcName] === 'function') {
            (iframe as any)[funcName](...args);
            mainLogInfo(`直接调用函数：${funcName}(${args.join(', ')})`);
          } else {
            mainLogWarn(`函数 ${funcName} 在 iframe 中不存在`);
          }
        }
      } catch (error) {
        mainLogError('执行 onclick 属性失败', error);
      }
    }

    // 最后尝试直接调用 click 方法（作为后备方案）
    if (typeof element.click === 'function') {
      element.click();
    }

    mainLogInfo(`模拟点击成功：${element.tagName}`, {
      onclick: onclickAttr,
      text: element.textContent?.trim(),
    });

    return true;
  } catch (error) {
    mainLogError('模拟点击异常', error);
    return false;
  }
}

async function updateChoice(currentChoiceElement: HTMLTableRowElement | null) {
  // 等待一段时间，确保页面状态稳定
  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (!isTrade) {
    return;
  }
  const button = currentChoiceElement?.querySelector('button');
  // 使用改进的模拟点击函数
  const clickSuccess = simulateClick(button as HTMLElement);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const input = iframeDocument?.getElementById('zpdl') as HTMLInputElement;

  // 先输入电量值
  if (input && currentChoice.elecVolume > 0) {
    const inputSuccess = simulateInput(input, currentChoice.elecVolume);
    if (inputSuccess) {
      mainLogInfo(`输入电量：${currentChoice.elecVolume}`, {
        gpid: currentChoice.id,
        elecVolume: currentChoice.elecVolume,
      });
      // 等待输入完成
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      mainLogWarn('输入电量失败，但继续执行后续流程');
    }
  } else {
    mainLogWarn('未找到输入框或电量值为0', {
      inputExists: !!input,
      elecVolume: currentChoice.elecVolume,
    });
  }

  if (!clickSuccess) {
    mainLogWarn('点击操作按钮失败，但继续执行后续流程');
  }

  const ZPButtion = iframeDocument?.getElementById('qdzp') as HTMLButtonElement;
  const ZPClickSuccess = simulateClick(ZPButtion as HTMLElement);
  if (!ZPClickSuccess) {
    mainLogWarn('点击摘牌按钮失败，但继续执行后续流程');
  }

  logger.debug('当前选择状态', {
    currentChoice,
    prevChoice,
    nextChoice,
    isTrade,
  });
  await executeCaptchaClickFlow();

  // 处理nextChoice

  currentChoiceElement?.classList.remove('current-choice');
  currentChoiceElement?.classList.add('prev-choice');
  if (nextChoice.length <= 0) {
    window.postMessage(
      {
        type: EXECUTION_TYPE.TRADE_END,
        message: JSON.stringify(currentChoice),
      },
      '*'
    );
    mainLogInfo('交易结束');
    return;
  }
  window.postMessage(
    {
      type: EXECUTION_TYPE.NEXT_CHOICE,
      message: JSON.stringify(currentChoice),
    },
    '*'
  );
}

export async function tradeIframe() {
  const table = iframeDocument?.getElementById('mcgpxx');
  if (!table) {
    return;
  }
  const tbody = table.querySelector('tbody');
  if (!tbody) {
    return;
  }

  const trs = tbody.querySelectorAll('tr');
  let currentChoiceElement: HTMLTableRowElement | null = null;

  trs.forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 9) {
      return;
    }
    // 从操作按钮中提取ID
    const actionButton = tds[7].querySelector('button');
    const actionOnclick = actionButton?.getAttribute('onclick') || '';
    const actionIDMatch = actionOnclick.match(/wyzp\((\d+)\)/);
    const gpid = actionIDMatch ? parseInt(actionIDMatch[1], 10) : 0;
    tr.classList.remove('current-choice', 'prev-choice', 'next-choice');

    if (gpid === currentChoice.id) {
      tr.classList.add('current-choice');
      currentChoiceElement = tr;
    } else if (prevChoice.some((item) => item.id === gpid)) {
      tr.classList.add('prev-choice');
    } else if (nextChoice.some((item) => item.id === gpid)) {
      tr.classList.add('next-choice');
    }
  });

  // 滚动到 current-choice 元素
  if (currentChoiceElement) {
    (currentChoiceElement as HTMLTableRowElement).scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    updateChoice(currentChoiceElement);
  }
}

window.addEventListener('message', (event) => {
  switch (event.data.type) {
    case EXECUTION_TYPE.INITIFRAME:
      init();
      if (!!iframeDocument) {
        mainLogInfo('初始化iframe成功');
      } else {
        mainLogError('初始化iframe失败');
      }
      const buyData = getMCGPTableData();
      if (buyData) {
        mainLogInfo('获取挂牌数据成功', buyData);
      } else {
        mainLogError('获取挂牌数据失败');
      }
      window.postMessage(
        {
          type: EXECUTION_TYPE.GET_SELL_DATA,
          message: JSON.stringify({ data: buyData }),
        },
        '*'
      );
      break;
    case EXECUTION_TYPE.CANCEL_TRADE:
      isTrade = false;
      mainLogInfo('终止交易', event.data.message);

      break;
    case EXECUTION_TYPE.TRADE:
      isTrade = true;
      mainLogInfo('交易', JSON.parse(event.data.message));
      const choiceSellData: CHOICE_SELL_DATA = JSON.parse(event.data.message);
      currentChoice = choiceSellData.currentChoice;
      prevChoice = choiceSellData.prevChoice;
      nextChoice = choiceSellData.nextChoice;
      tradeIframe();
  }
});
