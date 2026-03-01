'use client';
import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Holding, Settings, LiveQuote, TagGroup } from '@/types';
import { COLORS } from '@/lib/constants';
import { formatMoney, convertToBase } from '@/lib/utils';

interface Props {
  holdings: Holding[];
  cash: { id: string; currency: string; amount: number }[];
  settings: Settings;
  rates: Record<string, number>;
  liveData: Record<string, LiveQuote>;
  totalValue: number;
  tagGroups: TagGroup[];
  onSettingsChange: (patch: Partial<Settings>) => void;
}

const RADIAN = Math.PI / 180;

export default function AllocationTab({
  holdings, cash, settings, rates, liveData, totalValue, tagGroups, onSettingsChange,
}: Props) {
  const allocDims = settings.allocDims ?? ['holding'];

  const convert = (amount: number, cur: string) =>
    convertToBase(amount, cur, settings.baseCurrency, rates);

  const toggleDim = (id: string) => {
    const next = allocDims.includes(id)
      ? allocDims.filter(x => x !== id)
      : [...allocDims, id];
    onSettingsChange({ allocDims: next });
  };

  const getAllocData = (dim: string) => {
    const sums: Record<string, number> = {};

    if (dim === 'holding') {
      holdings.forEach(h => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        const p = h.trackType === 'auto' ? live!.price : (h.customPrice ?? 0);
        const c = h.trackType === 'auto' ? live!.currency : (h.customCurrency ?? h.currency);
        sums[h.symbol] = (sums[h.symbol] || 0) + convert(p * h.quantity, c);
      });
      cash.forEach(c => {
        sums[`💵 ${c.currency}`] = (sums[`💵 ${c.currency}`] || 0) + convert(c.amount, c.currency);
      });
    } else if (dim === 'currency') {
      holdings.forEach(h => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        const cur = h.trackType === 'auto' ? live!.currency : (h.customCurrency ?? h.currency);
        const p = h.trackType === 'auto' ? live!.price : (h.customPrice ?? 0);
        sums[cur] = (sums[cur] || 0) + convert(p * h.quantity, cur);
      });
      cash.forEach(c => {
        sums[c.currency] = (sums[c.currency] || 0) + convert(c.amount, c.currency);
      });
    } else if (dim.startsWith('tag-')) {
      const tagName = dim.replace('tag-', '');
      holdings.forEach(h => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        const p = h.trackType === 'auto' ? live!.price : (h.customPrice ?? 0);
        const c = h.trackType === 'auto' ? live!.currency : (h.customCurrency ?? h.currency);
        const tagVal = h.tags?.[tagName] || '未分类';
        sums[tagVal] = (sums[tagVal] || 0) + convert(p * h.quantity, c);
      });
      const totalCash = cash.reduce((s, c) => s + convert(c.amount, c.currency), 0);
      if (totalCash > 0) sums['💵 现金'] = (sums['💵 现金'] || 0) + totalCash;
    }

    return Object.entries(sums)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  const DIM_OPTIONS = [
    { id: 'holding',  label: '持仓标的' },
    { id: 'currency', label: '结算币种' },
    ...tagGroups.map(g => ({ id: `tag-${g.name}`, label: g.name })),
  ];

  return (
    <div className="space-y-6">
      {/* 维度切换 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-500 mr-1">显示维度：</span>
        {DIM_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => toggleDim(opt.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
              allocDims.includes(opt.id)
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 饼图网格 */}
      {allocDims.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-bold">请在上方选择至少一个维度</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allocDims.map(dim => {
            const data = getAllocData(dim);
            const title = dim === 'holding' ? '持仓标的' : dim === 'currency' ? '结算币种' : dim.replace('tag-', '');

            return (
              <div key={dim} className="bg-white p-6 rounded-xl shadow-sm border flex flex-col items-center">
                <h3 className="text-base font-bold text-gray-700 mb-4">{title} 分布</h3>
                {data.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 font-bold h-56">暂无数据</div>
                ) : (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data}
                          cx="50%" cy="50%"
                          innerRadius="35%" outerRadius="70%"
                          paddingAngle={2}
                          dataKey="value"
                          labelLine={false}
                          label={renderCustomLabel}
                        >
                          {data.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [`${formatMoney(val, settings.precision)} ${settings.baseCurrency}`, '金额']}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8}
                          wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* 明细列表 */}
                <div className="w-full mt-2 space-y-1.5">
                  {data.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="flex-1 text-gray-600 truncate">{d.name}</span>
                      <span className="text-gray-400">
                        {totalValue > 0 ? `${((d.value / totalValue) * 100).toFixed(1)}%` : '-'}
                      </span>
                    </div>
                  ))}
                  {data.length > 6 && (
                    <div className="text-[10px] text-gray-400 text-right">+{data.length - 6} 项更多</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
