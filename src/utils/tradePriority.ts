/**
 * 交易顺序算法：按挂牌价分档 + 倒计时排序。
 *
 * 规则：
 * 1. 挂牌价在最低价的 5% 以内：按倒计时从小到大排序，没有倒计时的排在最上面。
 * 2. 接下来按最低价的 10% 以内、20% 以内、20% 以上分档；档内同样按倒计时升序，无倒计时最前。
 *
 * 使用 getRecommendedTradeOrder() 得到按该顺序排列的列表。
 */
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

export function getTimeLeftMs(
  item: Pick<SELL_DATA_ITEM, 'xtdqsj' | 'zpsysj' | 'actionCountdownSeconds' | 'availableAtMs'>
): number | null {
  // 优先：摘牌时间戳(availableAtMs) - 当前时间戳(Date.now())，剩余毫秒
  if (item.availableAtMs !== undefined && Number.isFinite(item.availableAtMs)) {
    const nowMs = Date.now();
    return Math.max(0, item.availableAtMs - nowMs);
  }

  // 兜底：操作列「N秒后可摘牌」解析出的秒数（未写入时间戳的旧数据）
  if (item.actionCountdownSeconds !== undefined && Number.isFinite(item.actionCountdownSeconds)) {
    return Math.max(0, item.actionCountdownSeconds) * 1000;
  }

  // 到期时间 - 系统时间（两者都是“时刻”）
  const expireMs = parseDateTimeToMs(item.xtdqsj);
  const nowMs = parseDateTimeToMs(item.zpsysj);
  if (expireMs !== null && nowMs !== null) return expireMs - nowMs;

  // xtdqsj 本身就是倒计时（时长）
  const countdownMs = parseCountdownToMs(item.xtdqsj);
  if (countdownMs !== null) return countdownMs;

  // 兜底：只有到期时间时用当前时间估算
  if (expireMs !== null) return expireMs - Date.now();

  return null;
}

export type TradePriorityOptions = {
  /** 最低价比例档位，默认 [0.05, 0.10, 0.20] 即 5%、10%、20% */
  priceBands?: number[];
};

/** 同档内按倒计时排序：没有倒计时的排最前，然后按剩余时间从小到大 */
function compareByCountdownAsc(a: SELL_DATA_ITEM, b: SELL_DATA_ITEM): number {
  const ta = getTimeLeftMs(a);
  const tb = getTimeLeftMs(b);
  const hasA = ta !== null;
  const hasB = tb !== null;
  if (!hasA && !hasB) return 0;
  if (!hasA) return -1; // 无倒计时排最上
  if (!hasB) return 1;
  const msA = Math.max(0, ta);
  const msB = Math.max(0, tb);
  return msA - msB; // 倒计时从小到大
}

/**
 * 根据交易算法确定交易顺序：
 * 1. 挂牌价在最低价的 5% 以内：按倒计时从小到大，无倒计时排最上。
 * 2. 接着按最低价的 10%、20%、20% 以上分档，档内同样按倒计时升序、无倒计时最前。
 */
export function getRecommendedTradeOrder(
  items: SELL_DATA_ITEM[],
  options?: TradePriorityOptions
): SELL_DATA_ITEM[] {
  if (!items.length) return [];

  const minPrice = Math.min(...items.map((i) => i.gpdj ?? 0));
  const bands = options?.priceBands ?? [0.05, 0.1, 0.2]; // 5%, 10%, 20%

  /** 档位：0=5%内, 1=5%~10%, 2=10%~20%, 3=20%以上 */
  function getBand(item: SELL_DATA_ITEM): number {
    const p = item.gpdj ?? 0;
    if (minPrice <= 0) return 0;
    const ratio = p / minPrice;
    for (let i = 0; i < bands.length; i++) {
      if (ratio <= 1 + bands[i]) return i;
    }
    return bands.length;
  }

  return [...items].sort((a, b) => {
    const bandA = getBand(a);
    const bandB = getBand(b);
    if (bandA !== bandB) return bandA - bandB;
    return compareByCountdownAsc(a, b);
  });
}
