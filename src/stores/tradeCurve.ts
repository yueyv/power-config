import { defineStore } from 'pinia';
import type { TradeCurveDayItem } from '@/types';

const JYSB_QUERY_URL = 'https://pmos.sd.sgcc.com.cn:18080/zcq/scgpjy/jysb.do?method=querydatabale';

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
    async fetchByCjid(cjid: number): Promise<TradeCurveDayItem[] | null> {
      if (this.loadingCjids.has(cjid)) {
        return this.byCjid[cjid] ?? null;
      }
      this.loadingCjids.add(cjid);
      try {
        const form = new URLSearchParams();
        form.set('cjid', String(cjid));
        const raw = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', JYSB_QUERY_URL, true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
          xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
          xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          xhr.withCredentials = true;
          xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText);
            } else {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('XHR error'));
          xhr.send(form.toString());
        });
        let data: TradeCurveDayItem[] = [];
        try {
          const parsed = JSON.parse(raw);
          data = Array.isArray(parsed) ? parsed : parsed?.data ? parsed.data : [];
        } catch {
          data = [];
        }
        if (data.length > 0) {
          this.byCjid[cjid] = data;
        }
        return data;
      } catch {
        return null;
      } finally {
        this.loadingCjids.delete(cjid);
      }
    },

    /** 对一批交易 id 查缺补漏：没有缓存的会请求接口 */
    async ensureCurveData(cjids: number[]): Promise<void> {
      const missing = cjids.filter((id) => !this.hasCjid(id));
      await Promise.all(missing.map((cjid) => this.fetchByCjid(cjid)));
    },

    setRefCurve(points: number[] | null) {
      this.refCurve = points && points.length === 24 ? points : null;
    },
  },
});
