import { defineStore } from 'pinia';
import type { TradeCurveDayItem } from '@/types';
import { EXECUTION_TYPE } from '@/constants';

export const useTradeCurveStore = defineStore('tradeCurve', {
  state: () => ({
    /** 交易 id -> 该交易的曲线数据（多日） */
    byCjid: {} as Record<number, TradeCurveDayItem[]>,
    /** 正在请求的 cjid 集合，避免重复请求 */
    loadingCjids: new Set<number>(),
    /** 用户输入的参考曲线（24 点），用于表格拟合着色 */
    refCurve: null as number[] | null,
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
      this.refCurve = points && points.length === 24 ? points : null;
    },
  },
});
