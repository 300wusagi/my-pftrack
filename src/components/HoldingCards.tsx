'use client';
import React from 'react';
import { Holding, Settings, LiveQuote } from '@/types';
import { formatMoney, formatPercent, getPnlColor, getPnlBg } from '@/lib/utils';
import { convertToBase } from '@/lib/utils';

interface Props {
  holdings: Holding[];
  settings: Settings;
  rates: Record<string, number>;
  liveData: Record<string, LiveQuote>;
  isFetching: (sym: string) => boolean;
  totalValue: number;
  groupBy: string | null;
  tagGroups: { id: string; name: string; values: string[] }[];
  onEdit: (h: Holding) => void;
  onSell: (h: Holding) => void;
}

export default function HoldingCards({
  holdings, settings, rates, liveData, isFetching,
  totalValue, groupBy, tagGroups, onEdit, onSell,
}: Props) {
  const convert = (amount: number, cur: string) =>
    convertToBase(amount, cur, settings.baseCurrency, rates);

  const grouped: Record<string, Holding[]> = {};
  holdings.forEach(h => {
    const key = groupBy ? (h.tags?.[groupBy] || '未分类') : '全部';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  });

  return (
    <div className="space-y-4 px-4 pb-4">
      {Object.entries(grouped).map(([groupName, list]) => (
        <div key={groupName}>
          {groupBy && (
            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg mb-2">
              ▾ {groupName} <span className="text-gray-400 font-normal">({list.length})</span>
            </div>
          )}
          <div className="space-y-2">
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
              const pnlPercent = pnlBase != null && costValBase > 0 ? (pnlBase / costValBase) * 100 : null;
              const weight = totalValue > 0 && currentValBase ? (currentValBase / totalValue) * 100 : 0;
              const changePercent = isAuto && live?.changePercent != null ? live.changePercent : null;

              return (
                <div key={h.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  {/* 顶行：名称 + 标签 + 操作按钮 */}
                  <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 text-sm">
                          {isAuto && !isError && live ? live.name : (h.name || h.symbol)}
                        </span>
                        {!isAuto && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">自定义</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{h.symbol}</div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => onEdit(h)}
                        className="text-xs text-blue-600 font-bold px-2 py-1 rounded-lg hover:bg-blue-50"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => onSell(h)}
                        className="text-xs text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        卖出
                      </button>
                    </div>
                  </div>

                  {/* 数据网格 */}
                  <div className="grid grid-cols-2 gap-px bg-gray-100">
                    {/* 现价 */}
                    <div className="bg-white px-4 py-2.5">
                      <div className="text-[10px] text-gray-400 mb-0.5">现价</div>
                      {fetching ? (
                        <div className="text-xs text-blue-400 animate-pulse">抓取中…</div>
                      ) : isError ? (
                        <div className="text-xs text-red-400">获取失败</div>
                      ) : currentPrice != null ? (
                        <div>
                          <div className="text-sm font-bold text-gray-800">
                            {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </div>
                          <div className="text-[10px] text-gray-400">{curCurrency}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </div>

                    {/* 前日比 */}
                    <div className="bg-white px-4 py-2.5">
                      <div className="text-[10px] text-gray-400 mb-0.5">前日比</div>
                      {changePercent != null ? (
                        <div className={`text-sm font-bold ${getPnlColor(changePercent, settings.colorMode)}`}>
                          {formatPercent(changePercent)}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </div>

                    {/* 总现值 */}
                    <div className="bg-white px-4 py-2.5">
                      <div className="text-[10px] text-gray-400 mb-0.5">总现值</div>
                      <div className="text-sm font-bold text-gray-700">
                        {currentValBase != null ? formatMoney(currentValBase, settings.precision) : '-'}
                        {currentValBase != null && (
                          <span className="text-[10px] text-gray-400 ml-1">{settings.baseCurrency}</span>
                        )}
                      </div>
                    </div>

                    {/* 盈亏 */}
                    <div className="bg-white px-4 py-2.5">
                      <div className="text-[10px] text-gray-400 mb-0.5">盈亏</div>
                      {pnlBase != null ? (
                        <div>
                          <div className={`text-sm font-bold ${getPnlColor(pnlBase, settings.colorMode)}`}>
                            {(pnlBase >= 0 ? '+' : '') + formatMoney(pnlBase, settings.precision)}
                          </div>
                          {pnlPercent != null && (
                            <div className={`text-[10px] ${getPnlColor(pnlPercent, settings.colorMode)}`}>
                              {formatPercent(pnlPercent)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </div>
                  </div>

                  {/* 底行：数量 + 成本 + 占比 + 标签 */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 flex-wrap">
                    <span className="text-[11px] text-gray-500">
                      <span className="text-gray-400">数量 </span>{h.quantity}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      <span className="text-gray-400">成本 </span>
                      {h.costPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} {h.currency}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      <span className="text-gray-400">占比 </span>{weight.toFixed(2)}%
                    </span>
                    <div className="flex gap-1 flex-wrap ml-auto">
                      {Object.values(h.tags || {}).filter(Boolean).map((t, i) => (
                        <span key={i} className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                          {t as string}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
