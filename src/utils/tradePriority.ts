type MaybeString = string | null | undefined;

function parseDateTimeToMs(input: MaybeString): number | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // 1) 纯数字：可能是时间戳（秒或毫秒）
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    // 10 位左右通常是秒级
    if (raw.length <= 10) return n * 1000;
    return n;
  }

  // 2) 常见格式兼容：2026-02-02 12:34:56 / 2026/02/02 12:34:56
  const normalized = raw.replace(/\//g, '-');
  const ms = Date.parse(normalized);
  if (!Number.isNaN(ms)) return ms;
  return null;
}

function parseCountdownToMs(input: MaybeString): number | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // 00:01:23 / 01:23
  const hms = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hms) {
    const a = Number(hms[1]);
    const b = Number(hms[2]);
    const c = hms[3] ? Number(hms[3]) : null;
    // 1) mm:ss
    if (c === null) return (a * 60 + b) * 1000;
    // 2) hh:mm:ss
    return (a * 3600 + b * 60 + c) * 1000;
  }

  // 兼容 “12分34秒 / 34秒 / 1小时2分3秒”
  const hour = raw.match(/(\d+)\s*(?:小时|h)/i);
  const min = raw.match(/(\d+)\s*(?:分钟|分|m)(?!s)/i);
  const sec = raw.match(/(\d+)\s*(?:秒|s)/i);
  if (hour || min || sec) {
    const h = hour ? Number(hour[1]) : 0;
    const m = min ? Number(min[1]) : 0;
    const s = sec ? Number(sec[1]) : 0;
    if ([h, m, s].some((x) => Number.isNaN(x))) return null;
    return (h * 3600 + m * 60 + s) * 1000;
  }

  return null;
}

export function getTimeLeftMs(item: Pick<SELL_DATA_ITEM, 'xtdqsj' | 'zpsysj'>): number | null {
  // 优先：到期时间 - 系统时间（两者都是“时刻”）
  const expireMs = parseDateTimeToMs(item.xtdqsj);
  const nowMs = parseDateTimeToMs(item.zpsysj);
  if (expireMs !== null && nowMs !== null) return expireMs - nowMs;

  // 次选：xtdqsj 本身就是倒计时（时长）
  const countdownMs = parseCountdownToMs(item.xtdqsj);
  if (countdownMs !== null) return countdownMs;

  // 兜底：如果只有到期时间，就用真实 now 估算
  if (expireMs !== null) return expireMs - Date.now();

  return null;
}

export type TradePriorityOptions = {
  /**
   * 倒计时分桶阈值（毫秒），越小越优先。
   * 默认：<=30s, <=2min, <=5min, 其他
   */
  urgencyBucketsMs?: number[];
};

export function getValueScore(item: Pick<SELL_DATA_ITEM, 'gpdj' | 'xhprice' | 'dprice' | 'sydl'>) {
  // 性价比：优先“现货价值 - 挂牌价格”更大（单位：元/千瓦时）
  const spread = (item.xhprice ?? 0) - (item.gpdj ?? 0);
  // 适度偏好电量更大（更容易一次吃满），避免过度影响：取 log
  const volumeBoost = Math.log10(Math.max(1, item.sydl ?? 0) + 1);
  // dprice 常与 xhprice 相等/接近，这里只作为轻微稳定项
  const dpriceStability = -Math.abs((item.dprice ?? 0) - (item.xhprice ?? 0));
  return spread * 10 + volumeBoost + dpriceStability;
}

export function compareTradeCandidates(
  a: SELL_DATA_ITEM,
  b: SELL_DATA_ITEM,
  options: TradePriorityOptions = {}
) {
  const buckets = options.urgencyBucketsMs ?? [30_000, 120_000, 300_000];
  const ta = getTimeLeftMs(a);
  const tb = getTimeLeftMs(b);
  const ca = ta === null ? Number.POSITIVE_INFINITY : Math.max(ta, 0);
  const cb = tb === null ? Number.POSITIVE_INFINITY : Math.max(tb, 0);

  const bucketOf = (t: number) => {
    for (let i = 0; i < buckets.length; i++) {
      if (t <= buckets[i]) return i;
    }
    return buckets.length;
  };

  const ba = bucketOf(ca);
  const bb = bucketOf(cb);
  if (ba !== bb) return ba - bb; // 越紧急越靠前

  // 同一紧急程度内：性价比高的优先
  const va = getValueScore(a);
  const vb = getValueScore(b);
  if (va !== vb) return vb - va;

  // 再兜底：价格低优先
  if (a.gpdj !== b.gpdj) return (a.gpdj ?? 0) - (b.gpdj ?? 0);
  // 电量大优先
  return (b.sydl ?? 0) - (a.sydl ?? 0);
}
