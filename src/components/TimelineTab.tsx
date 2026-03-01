'use client';
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Snapshot, Settings } from '@/types';
import { formatMoney, getPnlColor } from '@/lib/utils';
import { TIMELINE_RANGES } from '@/lib/constants';

interface Props {
  snapshots: Snapshot[];
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
}

export default function TimelineTab({ snapshots, settings, onSettingsChange }: Props) {
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const range = settings.timelineRange ?? '3M';

  // 按时间范围过滤快照
  const filteredSnapshots = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const now = new Date();
    const cutoff: Record<string, Date> = {
      '1W': new Date(now.getTime() - 7  * 86400000),
      '1M': new Date(now.getTime() - 30 * 86400000),
      '3M': new Date(now.getTime() - 90 * 86400000),
      '6M': new Date(now.getTime() - 180 * 86400000),
      '1Y': new Date(now.getTime() - 365 * 86400000),
    };
    const from = cutoff[range];
    const filtered = from ? sorted.filter(s => new Date(s.date) >= from) : sorted;

    // 计算每日增减
    return filtered.map((s, i) => {
      if (i === 0) return { ...s, diffAmount: 0, diffPercent: 0 };
      const prev = filtered[i - 1].value;
      const diffAmount = s.value - prev;
      const diffPercent = prev > 0 ? (diffAmount / prev) * 100 : 0;
      return { ...s, diffAmount, diffPercent };
    });
  }, [snapshots, range]);

  // 整体区间涨跌
  const rangeChange = useMemo(() => {
    if (filteredSnapshots.length < 2) return null;
    const first = filteredSnapshots[0].value;
    const last = filteredSnapshots[filteredSnapshots.length - 1].value;
    return { amount: last - first, percent: first > 0 ? ((last - first) / first) * 100 : 0 };
  }, [filteredSnapshots]);

  // 日历快照Map
  const snapshotMap = useMemo(() => {
    const allSorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const enriched = allSorted.map((s, i) => {
      if (i === 0) return { ...s, diffAmount: 0, diffPercent: 0 };
      const prev = allSorted[i - 1].value;
      return { ...s, diffAmount: s.value - prev, diffPercent: prev > 0 ? ((s.value - prev) / prev) * 100 : 0 };
    });
    return Object.fromEntries(enriched.map(s => [s.date, s]));
  }, [snapshots]);

  // 日历渲染
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
        {/* 标题 + 月份切换 */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-gray-700">
            {year}年 {month + 1}月 · 盈亏日历
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
              className="px-3 py-1 text-sm font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >◀ 上月</button>
            <button
              onClick={() => setCalendarMonth(new Date())}
              className="px-3 py-1 text-sm font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >本月</button>
            <button
              onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
              className="px-3 py-1 text-sm font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >下月 ▶</button>
          </div>
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {['日','一','二','三','四','五','六'].map(d => (
            <div key={d} className="bg-gray-50 text-center py-1.5 text-xs font-bold text-gray-500">{d}</div>
          ))}
          {blanks.map((_, i) => (
            <div key={`b-${i}`} className="bg-white min-h-[72px] md:min-h-[90px]" />
          ))}
          {days.map(day => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const snap = snapshotMap[dateStr];
            const isPos = snap && snap.diffPercent > 0;
            const isNeg = snap && snap.diffPercent < 0;
            // 使用用户设置的颜色偏好
            const upCls = settings.colorMode === 'cn' ? 'text-red-500' : 'text-emerald-600';
            const downCls = settings.colorMode === 'cn' ? 'text-emerald-600' : 'text-red-500';
            const upBg  = settings.colorMode === 'cn' ? 'bg-red-50' : 'bg-emerald-50';
            const downBg = settings.colorMode === 'cn' ? 'bg-emerald-50' : 'bg-red-50';

            return (
              <div
                key={day}
                className={`bg-white min-h-[72px] md:min-h-[90px] p-1.5 flex flex-col justify-between border-t border-r border-gray-100 transition-colors
                  ${snap ? (isPos ? upBg : isNeg ? downBg : '') : ''}
                `}
              >
                <div className="text-gray-400 text-xs font-bold">{day}</div>
                {snap && (
                  <div className="text-center pb-1">
                    <div className={`text-xs font-bold leading-tight ${isPos ? upCls : isNeg ? downCls : 'text-gray-400'}`}>
                      {isPos ? '▲' : isNeg ? '▼' : ''}
                      {' '}{formatMoney(Math.abs(snap.diffAmount), 0)}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isPos ? upCls : isNeg ? downCls : 'text-gray-400'}`}>
                      {snap.diffPercent > 0 ? '+' : ''}{snap.diffPercent.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-xs text-gray-400 mt-3 text-right">
          * 金额单位：{settings.baseCurrency}
          {settings.colorMode === 'cn' ? '，红涨绿跌（中国惯例）' : '，绿涨红跌（国际惯例）'}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 折线图 */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-700">
              总资产历史走势
              <span className="text-sm text-gray-400 font-normal ml-2">({settings.baseCurrency})</span>
            </h3>
            {rangeChange && (
              <div className={`text-sm font-bold mt-0.5 ${getPnlColor(rangeChange.amount, settings.colorMode)}`}>
                {rangeChange.amount >= 0 ? '+' : ''}{formatMoney(rangeChange.amount, settings.precision)}
                <span className="text-xs ml-1 opacity-75">
                  ({rangeChange.percent >= 0 ? '+' : ''}{rangeChange.percent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          {/* 时间范围切换 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {TIMELINE_RANGES.map(r => (
              <button
                key={r}
                onClick={() => onSettingsChange({ timelineRange: r })}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  range === r ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          {filteredSnapshots.length < 2 ? (
            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed font-bold text-sm p-6 text-center">
              需要至少两天的记录才能绘制折线图。<br />每次打开应用时会自动记录当日快照。
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredSnapshots} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={d => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={v => formatMoney(v, 0)}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                  width={75}
                />
                <Tooltip
                  formatter={(val: any) => [`${formatMoney(val, settings.precision)} ${settings.baseCurrency}`, '总资产']}
                  labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                  contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                />
                <Line
                  type="monotone" dataKey="value"
                  stroke="#3b82f6" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: 'white', stroke: '#3b82f6' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 日历 */}
      {renderCalendar()}
    </div>
  );
}
