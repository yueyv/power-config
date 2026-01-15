import { EXECUTION_TYPE } from '@/constants';
import { mainLogError, mainLogInfo } from '@/model/log';
let iframe = undefined;
let iframeDocument: Document | undefined = undefined;

function init() {
  // @ts-ignore
  iframe = document.getElementsByClassName('body-iframe')?.[0].contentWindow;
  iframeDocument = iframe.document;
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
  }
});
