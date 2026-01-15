import { CHOICE_SELL_DATA_KEY, SELL_DATA_KEY, SELL_DATA_STATUS_KEY } from '@/constants';

export function getSellData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SELL_DATA_KEY, (result) => {
      resolve(result[SELL_DATA_KEY]);
    });
  });
}

export function setSellData(data: SELL_DATA_ITEM[]) {
  chrome.storage.local.set({ [SELL_DATA_KEY]: data });
}

export function getChoiceSellData() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(CHOICE_SELL_DATA_KEY, (result) => {
      resolve(result[CHOICE_SELL_DATA_KEY]);
    });
  });
}

export function setChoiceSellData(data: SELL_DATA_ITEM[]) {
  chrome.storage.local.set({ [CHOICE_SELL_DATA_KEY]: data });
}

export function getSellDataStatus() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SELL_DATA_STATUS_KEY, (result) => {
      resolve(result[SELL_DATA_STATUS_KEY]);
    });
  });
}

export function setSellDataStatus(data: string) {
  chrome.storage.local.set({ [SELL_DATA_STATUS_KEY]: data });
}
