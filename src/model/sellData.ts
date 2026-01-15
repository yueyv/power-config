import {
  CHOICE_SELL_DATA_KEY,
  SELL_DATA_KEY,
  SELL_DATA_STATUS_KEY,
  TRADE_ELECTRICITY_VOLUME_KEY,
} from '@/constants';

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
  return new Promise<CHOICE_SELL_DATA>((resolve, reject) => {
    chrome.storage.local.get(CHOICE_SELL_DATA_KEY, (result) => {
      resolve(result[CHOICE_SELL_DATA_KEY] as CHOICE_SELL_DATA);
    });
  });
}

export function setChoiceSellData(data: CHOICE_SELL_DATA) {
  chrome.storage.local.set({ [CHOICE_SELL_DATA_KEY]: data });
}

export function getSellDataStatus() {
  return new Promise<string | undefined>((resolve, reject) => {
    chrome.storage.local.get(SELL_DATA_STATUS_KEY, (result) => {
      resolve(result[SELL_DATA_STATUS_KEY] as string | undefined);
    });
  });
}

export function setSellDataStatus(data: string) {
  chrome.storage.local.set({ [SELL_DATA_STATUS_KEY]: data });
}

export function clearChoiceSellData() {
  chrome.storage.local.remove(CHOICE_SELL_DATA_KEY);
}

export function setTradeElectricityVolume(data: number) {
  chrome.storage.local.set({ [TRADE_ELECTRICITY_VOLUME_KEY]: data });
}

export function getTradeElectricityVolume() {
  return new Promise<number | undefined>((resolve, reject) => {
    chrome.storage.local.get(TRADE_ELECTRICITY_VOLUME_KEY, (result) => {
      resolve(result[TRADE_ELECTRICITY_VOLUME_KEY] as number | undefined);
    });
  });
}
