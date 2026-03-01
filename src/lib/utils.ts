import { Settings } from '@/types';

export function formatMoney(val: number | null | undefined, precision = 2): string {
  if (val == null || isNaN(val)) return '-';
  return val.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatPercent(val: number | null | undefined, precision = 2): string {
  if (val == null || isNaN(val)) return '-';
  return (val >= 0 ? '+' : '') + val.toFixed(precision) + '%';
}

// 盈亏颜色：支持国际惯例（绿涨红跌）和中国惯例（红涨绿跌）
export function getPnlColor(value: number, colorMode: Settings['colorMode']): string {
  if (value === 0) return 'text-gray-400';
  const up = colorMode === 'cn' ? 'text-red-500' : 'text-emerald-600';
  const down = colorMode === 'cn' ? 'text-emerald-600' : 'text-red-500';
  return value > 0 ? up : down;
}

export function getPnlBg(value: number, colorMode: Settings['colorMode']): string {
  if (value === 0) return 'bg-gray-50 text-gray-400';
  const up = colorMode === 'cn' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600';
  const down = colorMode === 'cn' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500';
  return value > 0 ? up : down;
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 币种换算：rates 是 open.er-api 返回的以 baseCurrency 为基准的汇率表
// 即 1 baseCurrency = rates[X] 个X币，所以 X → base = amount / rates[X]
export function convertToBase(
  amount: number,
  fromCur: string,
  baseCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCur === baseCurrency) return amount;
  return amount / (rates[fromCur] || 1);
}

export function isTagsEqual(t1: Record<string, string>, t2: Record<string, string>): boolean {
  const k1 = Object.keys(t1 || {}).filter((k) => t1[k]);
  const k2 = Object.keys(t2 || {}).filter((k) => t2[k]);
  if (k1.length !== k2.length) return false;
  return k1.every((k) => t1[k] === t2[k]);
}
