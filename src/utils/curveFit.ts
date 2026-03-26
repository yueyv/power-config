const H_KEYS = [
  'h0',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'h7',
  'h8',
  'h9',
  'h10',
  'h11',
  'h12',
  'h13',
  'h14',
  'h15',
  'h16',
  'h17',
  'h18',
  'h19',
  'h20',
  'h21',
  'h22',
  'h23',
] as const;

/** 从单日曲线数据取出 24 点数值 */
export function curveFromDay(day: TradeCurveDayItem): number[] {
  return H_KEYS.map((k) => Number(day[k]) || 0);
}

/**
 * 皮尔逊相关系数，用于衡量两条曲线趋势一致性（-1~1，越接近 1 趋势越一致）
 */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const meanA = sum(a.slice(0, n)) / n;
  const meanB = sum(b.slice(0, n)) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

/** 拟合等级：高 / 中 / 低 / 无数据 */
export type FitLevel = 'high' | 'medium' | 'low' | 'none';

/** 根据相关系数得到拟合等级（趋势一致程度） */
export function getFitLevel(corr: number): FitLevel {
  if (Number.isNaN(corr) || corr < -1 || corr > 1) return 'none';
  if (corr >= 0.85) return 'high';
  if (corr >= 0.6) return 'medium';
  if (corr >= -1) return 'low';
  return 'none';
}

/**
 * 计算参考曲线与某交易曲线数据的“最不相似程度”（取多日中与参考曲线相关度最低的一日）
 */
export function computeFitCorrelation(
  refCurve: number[],
  dayList: TradeCurveDayItem[] | undefined
): number | null {
  if (!refCurve.length || !dayList?.length) return null;
  let minCorr = 2;
  for (const day of dayList) {
    const curve = curveFromDay(day);
    const c = correlation(refCurve, curve);
    if (c < minCorr) minCorr = c;
  }
  return minCorr;
}
