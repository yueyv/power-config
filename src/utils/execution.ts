import { EXECUTION_TYPE } from '@/constants';
import { mainLogError, mainLogInfo } from '@/model/log';
let iframe = undefined;
let iframeDocument: Document | undefined = undefined;
let prevChoice: { id: number; elecVolume: number }[] = [];
let nextChoice: { id: number; elecVolume: number }[] = [];
let currentChoice: { id: number; elecVolume: number } = { id: 0, elecVolume: 0 };
function init() {
  // @ts-ignore
  iframe = document.getElementsByClassName('body-iframe')?.[0].contentWindow;
  iframeDocument = iframe.document;

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

async function updateChoice(currentChoiceElement: HTMLTableRowElement | null) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  // 处理nextChoice
  window.postMessage(
    {
      type: EXECUTION_TYPE.NEXT_CHOICE,
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
  console.log('nextChoice', nextChoice);
  if (nextChoice.length <= 0) {
    window.postMessage(
      {
        type: EXECUTION_TYPE.TRADE_END,
      },
      '*'
    );
    mainLogInfo('交易结束');
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
      mainLogInfo('终止交易', event.data.message);
      prevChoice = [];
      nextChoice = [];
      currentChoice = { id: 0, elecVolume: 0 };
      tradeIframe();
      break;
    case EXECUTION_TYPE.TRADE:
      mainLogInfo('交易', JSON.parse(event.data.message));
      const choiceSellData: CHOICE_SELL_DATA = JSON.parse(event.data.message);
      currentChoice = choiceSellData.currentChoice;
      prevChoice = choiceSellData.prevChoice;
      nextChoice = choiceSellData.nextChoice;
      tradeIframe();
  }
});
