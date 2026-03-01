'use client';
import React, { useState, useMemo } from 'react';
import { Holding, Settings, LiveQuote, TagGroup } from '@/types';
import { COL_OPTIONS } from '@/lib/constants';
import { formatMoney, formatPercent, getPnlColor, convertToBase } from '@/lib/utils';
import HoldingCards from './HoldingCards';

interface Props {
  holdings: Holding[];
  cash: { id: string; currency: string; amount: number }[];
  settings: Settings;
  rates: Record<string, number>;
  liveData: Record<string, LiveQuote>;
  isFetching: (sym: string) => boolean;
  totalValue: number;
  tagGroups: TagGroup[];
  onAddBuy: () => void;
  onCash: () => void;
  onEdit: (h: Holding) => void;
  onSell: (h: Holding) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onRefresh: () => void;
}

export default function HoldingsTab({
  holdings, cash, settings, rates, liveData, isFetching,
  totalValue, tagGroups, onAddBuy, onCash, onEdit, onSell,
  onSettingsChange, onRefresh,
}: Props) {
  const [showColToggle, setShowColToggle] = useState(false);
  const groupBy = settings.holdingsGroupBy;

  const convert = (amount: number, cur: string) =>
    convertToBase(amount, cur, settings.baseCurrency, rates);

  const grouped = useMemo(() => {
    if (!groupBy) return { '全部': holdings };
    const g: Record<string, Holding[]> = {};
    holdings.forEach(h => {
      const key = h.tags?.[groupBy] || '未分类';
      if (!g[key]) g[key] = [];
      g[key].push(h);
    });
    return g;
  }, [holdings, groupBy]);

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-base font-bold text-gray-700">资产明细</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {/* 分组 */}
          <select
            className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-sm font-medium shadow-sm outline-none cursor-pointer"
            value={groupBy || ''}
            onChange={e => onSettingsChange({ holdingsGroupBy: e.target.value || null })}
          >
            <option value="">📁 不分组</option>
            {tagGroups.map(g => <option key={g.name} value={g.name}>按 {g.name}</option>)}
          </select>

          {/* 列显示（仅桌面） */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setShowColToggle(!showColToggle)}
              className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-sm font-medium shadow-sm"
            >
              ⚙️ 列显示
            </button>
            {showColToggle && (
              <div className="absolute top-10 right-0 bg-white border shadow-xl rounded-xl p-3 z-20 w-44 space-y-1">
                {COL_OPTIONS.map(col => (
                  <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={settings.visibleCols.includes(col.id)}
                      onChange={e => {
                        const newCols = e.target.checked
                          ? [...settings.visibleCols, col.id]
                          : settings.visibleCols.filter(c => c !== col.id);
                        onSettingsChange({ visibleCols: newCols });
                      }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={onRefresh} className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50">
            ↻ 刷新
          </button>
          <button onClick={onCash} className="bg-white border text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50">
            💵 现金
          </button>
          <button onClick={onAddBuy} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">
            记录买入
          </button>
        </div>
      </div>

      {/* 现金卡片 */}
      <div className="bg-white rounded-xl shadow-sm border p-3 flex gap-3 overflow-x-auto">
        {cash.map(c => (
          <div key={c.id} className="min-w-[110px] p-3 bg-gray-50 border rounded-lg flex-shrink-0">
            <div className="text-xs text-gray-500 font-bold mb-1">💵 {c.currency}</div>
            <div className="text-base font-bold text-gray-800">{formatMoney(c.amount, settings.precision)}</div>
          </div>
        ))}
        {cash.length === 0 && (
          <div className="text-sm text-gray-400 py-2">暂无现金记录</div>
        )}
      </div>

      {/* 手机：卡片视图 */}
      <div className="md:hidden">
        <HoldingCards
          holdings={holdings} settings={settings} rates={rates}
          liveData={liveData} isFetching={isFetching}
          totalValue={totalValue} groupBy={groupBy} tagGroups={tagGroups}
          onEdit={onEdit} onSell={onSell}
        />
      </div>

      {/* 桌面：表格视图 */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b text-xs text-gray-500">
              <tr>
                {COL_OPTIONS.filter(c => settings.visibleCols.includes(c.id)).map(col => (
                  <th key={col.id} className={`p-4 font-semibold ${['quantity','price','cost','value','pnl','dayChange','weight'].includes(col.id) ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {Object.entries(grouped).map(([groupName, list]) => (
                <React.Fragment key={groupName}>
                  {groupBy && (
                    <tr className="bg-blue-50/60">
                      <td colSpan={settings.visibleCols.length} className="px-4 py-2 text-xs font-bold text-blue-600">
                        ▾ {groupName} <span className="text-gray-400 font-normal">({list.length})</span>
                      </td>
                    </tr>
                  )}
                  {list.map(h => {
                    const isAuto = h.trackType === 'auto';
                    const live = liveData[h.symbol];
                    const fetching = isFetching(h.symbol);
                    const isError = isAuto && live?.error;

                    const currentPrice = isAuto ? (live && !isError ? live.price : null) : h.customPrice;
                    const curCurrency = isAuto ? (live?.currency ?? h.currency) : (h.customCurrency ?? h.currency);
                    const currentValBase = currentPrice != null ? convert(currentPrice * h.quantity, curCurrency) : null;
                    const costValBase = convert(h.costPrice * h.quantity, h.currency);
                    const pnlBase = currentValBase != null ? currentValBase - costValBase : null;
                    const pnlPct = pnlBase != null && costValBase > 0 ? (pnlBase / costValBase) * 100 : null;
                    const weight = totalValue > 0 && currentValBase ? (currentValBase / totalValue) * 100 : 0;
                    const changePercent = isAuto && live?.changePercent != null ? live.changePercent : null;

                    return (
                      <tr key={h.id} className="hover:bg-gray-50">
                        {settings.visibleCols.includes('symbol') && (
                          <td className="p-4">
                            <div className="font-bold text-gray-800">
                              {isAuto && !isError && live ? live.name : (h.name || h.symbol)}
                              {!isAuto && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded ml-2">自定义</span>}
                            </div>
                            <div className="text-xs text-gray-400">{h.symbol}</div>
                          </td>
                        )}
                        {settings.visibleCols.includes('quantity') && (
                          <td className="p-4 text-right">{h.quantity}</td>
                        )}
                        {settings.visibleCols.includes('price') && (
                          <td className="p-4 text-right">
                            {fetching ? <span className="text-xs text-blue-400 animate-pulse">抓取中…</span>
                              : isError ? <span className="text-xs text-red-400 bg-red-50 px-2 py-0.5 rounded">获取失败</span>
                              : currentPrice != null ? (
                                <div>
                                  <div className="font-bold">{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                                  <div className="text-xs text-gray-400">{curCurrency}</div>
                                </div>
                              ) : '-'}
                          </td>
                        )}
                        {settings.visibleCols.includes('cost') && (
                          <td className="p-4 text-right text-gray-500">
                            {h.costPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            <span className="text-[10px] text-gray-400 ml-1">{h.currency}</span>
                          </td>
                        )}
                        {settings.visibleCols.includes('value') && (
                          <td className="p-4 text-right font-bold text-gray-700">
                            {currentValBase != null ? (
                              <>{formatMoney(currentValBase, settings.precision)}<span className="text-[10px] text-gray-400 ml-1">{settings.baseCurrency}</span></>
                            ) : '-'}
                          </td>
                        )}
                        {settings.visibleCols.includes('pnl') && (
                          <td className={`p-4 text-right font-bold ${pnlBase != null ? getPnlColor(pnlBase, settings.colorMode) : 'text-gray-400'}`}>
                            {pnlBase != null ? (
                              <>
                                {(pnlBase >= 0 ? '+' : '') + formatMoney(pnlBase, settings.precision)}
                                {pnlPct != null && <div className="text-[10px] opacity-75">{formatPercent(pnlPct)}</div>}
                              </>
                            ) : '-'}
                          </td>
                        )}
                        {settings.visibleCols.includes('dayChange') && (
                          <td className={`p-4 text-right font-bold ${changePercent != null ? getPnlColor(changePercent, settings.colorMode) : 'text-gray-400'}`}>
                            {changePercent != null ? formatPercent(changePercent) : '-'}
                          </td>
                        )}
                        {settings.visibleCols.includes('weight') && (
                          <td className="p-4 text-right text-gray-500">{weight.toFixed(2)}%</td>
                        )}
                        {settings.visibleCols.includes('tags') && (
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {Object.values(h.tags || {}).filter(Boolean).map((t, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 border text-gray-600 px-2 py-0.5 rounded-full">{t as string}</span>
                              ))}
                            </div>
                          </td>
                        )}
                        {settings.visibleCols.includes('action') && (
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => onEdit(h)} className="text-blue-600 font-bold text-xs px-2 py-1 rounded hover:bg-blue-50">编辑</button>
                              <button onClick={() => onSell(h)} className="text-red-500 font-bold text-xs px-2 py-1 rounded hover:bg-red-50">卖出</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
