import { defineStore } from 'pinia';
import { EXECUTION_TYPE, REF_CURVE_KEY } from '@/constants';

export const useTradeCurveStore = defineStore('tradeCurve', {
  state: () => ({
    /** 交易 id -> 该交易的曲线数据（多日） */
    byCjid: {} as Record<number, TradeCurveDayItem[]>,
    /** 正在请求的 cjid 集合，避免重复请求 */
    loadingCjids: new Set<number>(),
    /** 用户输入的参考曲线（24 点），用于表格拟合着色；与 chrome.storage 同步 */
    refCurve: null as number[] | null,
    /** 曲线数据更新版本，用于表格强制重算行样式（byCjid 变化时递增） */
    curveDataVersion: 0,
  }),

  getters: {
    getByCjid:
      (state) =>
      (cjid: number): TradeCurveDayItem[] | undefined => {
        return state.byCjid[cjid];
      },

    hasCjid: (state) => (cjid: number) => {
      return Array.isArray(state.byCjid[cjid]) && state.byCjid[cjid].length > 0;
    },
  },

  actions: {
    /**
     * 从 chrome.storage 恢复参考曲线（应用启动时调用一次）
     */
    async initRefCurveFromStorage(): Promise<void> {
      if (typeof chrome?.storage?.local?.get !== 'function') return;
      return new Promise((resolve) => {
        chrome.storage.local.get(REF_CURVE_KEY, (result) => {
          const raw = result[REF_CURVE_KEY];
          if (Array.isArray(raw) && raw.length === 24) {
            const points = raw.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0));
            this.refCurve = points;
          }
          resolve();
        });
      });
    },

    /**
     * 通过 postMessage 请求在 iframe（jysb.do）内发起 XHR 拉取曲线；
     * 结果由 content 收到 JYSB_CURVE_RESULT 后调用 setCurveData 写入。
     */
    fetchByCjid(cjid: number): void {
      if (this.loadingCjids.has(cjid)) return;
      this.loadingCjids.add(cjid);
      if (typeof window !== 'undefined') {
        window.postMessage(
          { type: EXECUTION_TYPE.REQUEST_JYSB_CURVE, cjids: [cjid] },
          '*'
        );
      } else {
        this.loadingCjids.delete(cjid);
      }
    },

    /** 收到 iframe 内 XHR 结果时由 content 调用，写入缓存并移除 loading */
    setCurveData(cjid: number, data: TradeCurveDayItem[]): void {
      this.loadingCjids.delete(cjid);
      if (data && data.length > 0) {
        this.byCjid[cjid] = data;
        this.curveDataVersion += 1;
      }
    },

    /** 对一批交易 id 查缺补漏：没有缓存的会通过 iframe 内 XHR 请求 */
    ensureCurveData(cjids: number[]): void {
      const missing = cjids.filter((id) => !this.hasCjid(id));
      if (missing.length === 0) return;
      missing.forEach((cjid) => this.loadingCjids.add(cjid));
      if (typeof window !== 'undefined') {
        window.postMessage(
          { type: EXECUTION_TYPE.REQUEST_JYSB_CURVE, cjids: missing },
          '*'
        );
      } else {
        missing.forEach((cjid) => this.loadingCjids.delete(cjid));
      }
    },

    setRefCurve(points: number[] | null) {
      const value = points && points.length === 24 ? points : null;
      this.refCurve = value;
      if (typeof chrome?.storage?.local?.set === 'function') {
        chrome.storage.local.set({ [REF_CURVE_KEY]: value ?? [] });
      }
    },
  },
});
