'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4',
];
const CURRENCIES = ['USD', 'HKD', 'JPY', 'CNY', 'EUR'];

const COL_OPTIONS = [
  { id: 'symbol', label: '标的' },
  { id: 'quantity', label: '数量' },
  { id: 'price', label: '现价' },
  { id: 'cost', label: '成本单价' },
  { id: 'value', label: '总现值' },
  { id: 'pnl', label: '总盈亏' },
  { id: 'weight', label: '占比' },
  { id: 'tags', label: '标签' },
  { id: 'action', label: '操作' },
];

export default function PortfolioApp() {
  const [activeTab, setActiveTab] = useState('holdings');
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    baseCurrency: 'USD',
    visibleCols: [
      'symbol', 'quantity', 'price', 'cost',
      'value', 'pnl', 'weight', 'tags', 'action',
    ],
  });
  const [cash, setCash] = useState<any[]>([
    { id: 'c1', currency: 'USD', amount: 15000 },
  ]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [tagGroups, setTagGroups] = useState<any[]>([
    { id: 'g1', name: '板块', values: ['科技', '金融', '医疗'] },
    { id: 'g2', name: '券商', values: ['Moomoo', '乐天'] },
  ]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });

  const [allocDims, setAllocDims] = useState<string[]>(['holding']);
  const [showColToggle, setShowColToggle] = useState(false);
  
  // 新增：用于持仓列表的分组状态
  const [groupBy, setGroupBy] = useState<string | null>(null);

  const [modalType, setModalType] = useState<string | null>(null);
  const [sellTarget, setSellTarget] = useState<any>(null);
  const [tradeStep, setTradeStep] = useState(1);
  const [tradeForm, setTradeForm] = useState<any>({
    id: null,
    trackType: 'auto',
    symbol: '',
    name: '',
    quantity: '',
    price: '',
    currency: 'USD',
    customPrice: '',
    customCurrency: 'USD',
    tags: {},
    cashOp: 'add',
    amount: '',
  });

  useEffect(() => {
    const load = (k: string, def: any) => {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : def;
    };
    const savedSet = load('pf_set', null);
    if (savedSet) {
      setSettings({
        baseCurrency: savedSet.baseCurrency || 'USD',
        visibleCols: savedSet.visibleCols || COL_OPTIONS.map(c => c.id),
      });
    }
    setCash(load('pf_csh', cash));
    setHoldings(load('pf_hld', holdings));
    setTagGroups(load('pf_tag', tagGroups));
    setSnapshots(load('pf_snp', []));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    localStorage.setItem('pf_set', JSON.stringify(settings));
    localStorage.setItem('pf_csh', JSON.stringify(cash));
    localStorage.setItem('pf_hld', JSON.stringify(holdings));
    localStorage.setItem('pf_tag', JSON.stringify(tagGroups));
    localStorage.setItem('pf_snp', JSON.stringify(snapshots));
  }, [settings, cash, holdings, tagGroups, snapshots, loading]);

  useEffect(() => {
    fetch(`https://open.er-api.com/v6/latest/${settings.baseCurrency}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rates) setRates(data.rates);
      });

    holdings.forEach(async (h: any) => {
      if (h.trackType === 'custom') return;
      try {
        const res = await fetch(`/api/quote?symbol=${h.symbol}`);
        if (res.ok) {
          const data = await res.json();
          setLiveData((prev) => ({
            ...prev,
            [h.symbol]: {
              price: data.price,
              currency: data.currency,
              name: data.name,
            },
          }));
        } else {
          setLiveData((prev) => ({ ...prev, [h.symbol]: { error: true } }));
        }
      } catch (e) {
        setLiveData((prev) => ({ ...prev, [h.symbol]: { error: true } }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length, settings.baseCurrency]);

  const convert = (amount: number, fromCur: string) => 
    fromCur === settings.baseCurrency ? amount : amount / (rates[fromCur] || 1);

  const totalValue =
    cash.reduce((sum, c) => sum + convert(c.amount, c.currency), 0) +
    holdings.reduce((sum, h) => {
      const live = liveData[h.symbol];
      if (h.trackType === 'auto' && (!live || live.error)) return sum;
      const p = h.trackType === 'auto' ? live.price : h.customPrice;
      const c = h.trackType === 'auto' ? live.currency : h.customCurrency;
      return sum + convert(p * h.quantity, c);
    }, 0);

  useEffect(() => {
    if (loading || totalValue <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    setSnapshots((prev) => {
      const exists = prev.find((s) => s.date === today);
      if (exists && exists.value === totalValue) return prev;
      if (exists)
        return prev.map((s) =>
          s.date === today ? { ...s, value: totalValue } : s
        );
      return [...prev, { date: today, value: totalValue }];
    });
  }, [totalValue, loading]);

  // 新增：计算带有每日盈亏变化的快照历史
  const enrichedSnapshots = useMemo(() => {
    return snapshots.map((s, i) => {
      if (i === 0) return { ...s, diffAmount: 0, diffPercent: 0 };
      const prevVal = snapshots[i - 1].value;
      const diffAmount = s.value - prevVal;
      const diffPercent = prevVal > 0 ? (diffAmount / prevVal) * 100 : 0;
      return { ...s, diffAmount, diffPercent };
    }).reverse(); // 倒序，最新的日期在最上面
  }, [snapshots]);

  // 分组逻辑
  const groupedHoldings = useMemo(() => {
    if (!groupBy) return { '所有资产': holdings };
    const groups: Record<string, any[]> = {};
    holdings.forEach(h => {
      const tagVal = h.tags?.[groupBy] || '未分类';
      if (!groups[tagVal]) groups[tagVal] = [];
      groups[tagVal].push(h);
    });
    return groups;
  }, [holdings, groupBy]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(tradeForm.quantity);
    const price = parseFloat(tradeForm.price);

    setHoldings((hld) =>
      hld.map((h) => {
        if (h.id === tradeForm.id) {
          return {
            ...h,
            name: tradeForm.name,
            quantity: qty,
            costPrice: price,
            currency: tradeForm.currency,
            customPrice:
              tradeForm.trackType === 'custom'
                ? parseFloat(tradeForm.customPrice) || price
                : null,
            customCurrency:
              tradeForm.trackType === 'custom'
                ? tradeForm.customCurrency
                : null,
            tags: tradeForm.tags,
          };
        }
        return h;
      })
    );
    setModalType(null);
  };

  const handleCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(tradeForm.amount) || 0;
    const op = tradeForm.cashOp;
    const cur = tradeForm.currency;

    setCash((prev) => {
      const existing = prev.find((c) => c.currency === cur);
      if (op === 'set') {
        if (existing)
          return prev.map((c) =>
            c.currency === cur ? { ...c, amount: amt } : c
          );
        return [
          ...prev,
          { id: Date.now().toString(), currency: cur, amount: amt },
        ];
      }
      if (existing) {
        return prev.map((c) =>
          c.currency === cur
            ? {
                ...c,
                amount:
                  op === 'add' ? c.amount + amt : Math.max(0, c.amount - amt),
              }
            : c
        );
      }
      return op === 'add'
        ? [...prev, { id: Date.now().toString(), currency: cur, amount: amt }]
        : prev;
    });
    setModalType(null);
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(tradeForm.quantity);
    const price = parseFloat(tradeForm.price);
    const cur = tradeForm.currency;
    if (qty > sellTarget.quantity)
      return alert(`最多可卖出 ${sellTarget.quantity}`);

    const proceeds = qty * price;
    setCash((prev) => {
      const existing = prev.find((c) => c.currency === cur);
      if (existing)
        return prev.map((c) =>
          c.currency === cur ? { ...c, amount: c.amount + proceeds } : c
        );
      return [
        ...prev,
        { id: Date.now().toString(), currency: cur, amount: proceeds },
      ];
    });

    if (qty === sellTarget.quantity) {
      setHoldings((prev) => prev.filter((h) => h.id !== sellTarget.id));
    } else {
      setHoldings((prev) =>
        prev.map((h) =>
          h.id === sellTarget.id ? { ...h, quantity: h.quantity - qty } : h
        )
      );
    }
    setModalType(null);
  };

  const handleBuySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tradeStep === 1 && tagGroups.length > 0) return setTradeStep(2);

    const qty = parseFloat(tradeForm.quantity);
    const cost = qty * parseFloat(tradeForm.price);

    let hasCashAcc = cash.find((c) => c.currency === tradeForm.currency);
    setCash((prevCash) =>
      hasCashAcc
        ? prevCash.map((c) =>
            c.currency === tradeForm.currency
              ? { ...c, amount: c.amount - cost }
              : c
          )
        : [
            ...prevCash,
            {
              id: Date.now().toString(),
              currency: tradeForm.currency,
              amount: -cost,
            },
          ]
    );

    const sym = tradeForm.symbol.toUpperCase();
    const existing = holdings.find((h) => h.symbol === sym);
    if (existing) {
      const newQty = existing.quantity + qty;
      const newCost = (existing.quantity * existing.costPrice + cost) / newQty;
      setHoldings((hld) =>
        hld.map((h) =>
          h.symbol === sym
            ? {
                ...h,
                quantity: newQty,
                costPrice: newCost,
                tags: { ...h.tags, ...tradeForm.tags },
              }
            : h
        )
      );
    } else {
      setHoldings((hld) => [
        ...hld,
        {
          id: Date.now().toString(),
          trackType: tradeForm.trackType,
          symbol: sym,
          name: tradeForm.name || sym,
          quantity: qty,
          costPrice: parseFloat(tradeForm.price),
          currency: tradeForm.currency,
          customPrice:
            parseFloat(tradeForm.customPrice) || parseFloat(tradeForm.price),
          customCurrency: tradeForm.customCurrency,
          tags: tradeForm.tags,
        },
      ]);
    }
    setModalType(null);
  };

  const getAllocData = (dim: string) => {
    let sums: Record<string, number> = {};
    if (dim === 'holding') {
      holdings.forEach((h: any) => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        sums[h.symbol] =
          (sums[h.symbol] || 0) +
          convert(
            (h.trackType === 'auto' ? live.price : h.customPrice) * h.quantity,
            h.trackType === 'auto' ? live.currency : h.customCurrency
          );
      });
      cash.forEach((c: any) => {
        sums[`💵 ${c.currency}`] =
          (sums[`💵 ${c.currency}`] || 0) + convert(c.amount, c.currency);
      });
    } else if (dim === 'currency') {
      holdings.forEach((h: any) => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        const cur = h.trackType === 'auto' ? live.currency : h.customCurrency;
        sums[cur] =
          (sums[cur] || 0) +
          convert(
            (h.trackType === 'auto' ? live.price : h.customPrice) * h.quantity,
            cur
          );
      });
      cash.forEach((c: any) => {
        sums[c.currency] =
          (sums[c.currency] || 0) + convert(c.amount, c.currency);
      });
    } else if (dim.startsWith('tag-')) {
      const tagName = dim.replace('tag-', '');
      holdings.forEach((h: any) => {
        const live = liveData[h.symbol];
        if (h.trackType === 'auto' && (!live || live.error)) return;
        const tagVal = h.tags?.[tagName] || '未分类';
        sums[tagVal] =
          (sums[tagVal] || 0) +
          convert(
            (h.trackType === 'auto' ? live.price : h.customPrice) * h.quantity,
            h.trackType === 'auto' ? live.currency : h.customCurrency
          );
      });
      const totalCash = cash.reduce(
        (sum: number, c: any) => sum + convert(c.amount, c.currency),
        0
      );
      if (totalCash > 0) sums['💵 现金'] = totalCash;
    }
    return Object.keys(sums)
      .map((k) => ({ name: k, value: sums[k] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  // 提取公用组件：代码输入提示小贴士
  const TickerTooltip = () => (
    <div className="relative group cursor-pointer inline-flex ml-1">
      <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">?</span>
      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-800 text-white text-xs p-3 rounded-lg shadow-xl z-50">
        <p className="font-bold mb-1 text-blue-300">雅虎财经代码规则:</p>
        <ul className="space-y-1">
          <li>🇺🇸 <span className="text-gray-300">美股:</span> 直接输入 (如 NVDA)</li>
          <li>🇭🇰 <span className="text-gray-300">港股:</span> 代码.HK (如 0700.HK)</li>
          <li>🇯🇵 <span className="text-gray-300">日股:</span> 代码.T (如 9984.T)</li>
          <li>🇨🇳 <span className="text-gray-300">A股(沪):</span> 代码.SS (如 600519.SS)</li>
          <li>🇨🇳 <span className="text-gray-300">A股(深):</span> 代码.SZ (如 002594.SZ)</li>
        </ul>
      </div>
    </div>
  );

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-blue-600">
            PF<span className="text-gray-800">TRACK</span>
          </h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">
            {totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 font-bold">
            总资产 ({settings.baseCurrency})
          </div>
        </div>
      </div>
      <div className="bg-white px-6 flex space-x-6 border-b overflow-x-auto">
        {[
          { id: 'holdings', label: '持仓一览' },
          { id: 'allocation', label: '资产分布' },
          { id: 'timeline', label: '历史走势' },
          { id: 'settings', label: '设置与标签' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {activeTab === 'holdings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-lg font-bold">资产明细</h2>
              <div className="flex gap-2 relative flex-wrap">
                <select
                  className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-sm font-bold shadow-sm outline-none cursor-pointer"
                  value={groupBy || ''}
                  onChange={(e) => setGroupBy(e.target.value || null)}
                >
                  <option value="">📁 不分组</option>
                  {tagGroups.map(g => (
                    <option key={g.name} value={g.name}>按 {g.name} 分组</option>
                  ))}
                </select>

                <button
                  onClick={() => setShowColToggle(!showColToggle)}
                  className="bg-white border text-gray-600 px-3 py-2 rounded-lg text-sm font-bold shadow-sm"
                >
                  ⚙️ 列显示
                </button>
                {showColToggle && (
                  <div className="absolute top-12 left-0 bg-white border shadow-xl rounded-xl p-3 z-20 w-48 space-y-2">
                    {COL_OPTIONS.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          className="accent-blue-600"
                          checked={settings.visibleCols.includes(col.id)}
                          onChange={(e) => {
                            const newCols = e.target.checked
                              ? [...settings.visibleCols, col.id]
                              : settings.visibleCols.filter(
                                  (c) => c !== col.id
                                );
                            setSettings({ ...settings, visibleCols: newCols });
                          }}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setTradeForm({
                      cashOp: 'add',
                      currency: settings.baseCurrency,
                      amount: '',
                    });
                    setModalType('cash');
                  }}
                  className="bg-white border text-gray-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50"
                >
                  存取现金
                </button>
                <button
                  onClick={() => {
                    setTradeStep(1);
                    setTradeForm({
                      trackType: 'auto',
                      symbol: '',
                      name: '',
                      quantity: '',
                      price: '',
                      currency: settings.baseCurrency,
                      customPrice: '',
                      customCurrency: settings.baseCurrency,
                      tags: {},
                    });
                    setModalType('buy');
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors"
                >
                  记录买入
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4 flex gap-4 overflow-x-auto">
              {cash.map((c: any) => (
                <div
                  key={c.id}
                  className="min-w-[120px] p-3 bg-gray-50 border rounded-lg"
                >
                  <div className="text-xs text-gray-500 font-bold mb-1">
                    💵 {c.currency}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {c.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500">
                    <tr>
                      {COL_OPTIONS.map(
                        (col) =>
                          settings.visibleCols.includes(col.id) && (
                            <th
                              key={col.id}
                              className={`p-4 font-semibold ${
                                ['quantity','price','cost','value','pnl','weight'].includes(col.id)
                                  ? 'text-right'
                                  : ''
                              }`}
                            >
                              {col.label}
                            </th>
                          )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {Object.entries(groupedHoldings).map(([groupName, groupList]) => (
                      <React.Fragment key={groupName}>
                        {groupBy && (
                          <tr className="bg-gray-50/80">
                            <td colSpan={settings.visibleCols.length} className="px-4 py-2 font-bold text-blue-600 text-xs border-y">
                              ▾ {groupName} <span className="text-gray-400 font-normal">({groupList.length})</span>
                            </td>
                          </tr>
                        )}
                        {groupList.map((h: any) => {
                          const isAuto = h.trackType === 'auto';
                          const live = liveData[h.symbol];
                          const isError = isAuto && live?.error;
                          const isFetching = isAuto && !live;

                          const currentPrice = isAuto ? (live && !isError ? live.price : null) : h.customPrice;
                          const curCurrency = isAuto ? (live && !isError ? live.currency : h.currency) : h.customCurrency;

                          const currentValBase = currentPrice ? convert(currentPrice * h.quantity, curCurrency) : null;
                          const costValBase = convert(h.costPrice * h.quantity, h.currency);
                          const pnlBase = currentValBase ? currentValBase - costValBase : null;
                          const weight = totalValue > 0 && currentValBase ? (currentValBase / totalValue) * 100 : 0;

                          return (
                            <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                              {settings.visibleCols.includes('symbol') && (
                                <td className="p-4">
                                  <div className="font-bold text-base text-gray-800">
                                    {isAuto && !isError && !isFetching ? live.name : h.name || h.symbol}
                                    {!isAuto && (
                                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded ml-2 align-middle">
                                        自定义
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">{h.symbol}</div>
                                </td>
                              )}
                              {settings.visibleCols.includes('quantity') && (
                                <td className="p-4 text-right font-medium">{h.quantity}</td>
                              )}
                              {settings.visibleCols.includes('price') && (
                                <td className="p-4 text-right">
                                  {isError ? (
                                    <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">获取失败</span>
                                  ) : isFetching ? (
                                    <span className="text-xs text-blue-500 animate-pulse">抓取中...</span>
                                  ) : (
                                    <>
                                      <div className="font-bold">
                                        {currentPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-xs text-gray-400">{curCurrency}</div>
                                    </>
                                  )}
                                </td>
                              )}
                              {settings.visibleCols.includes('cost') && (
                                <td className="p-4 text-right text-gray-600">
                                  {h.costPrice.toFixed(2)}{' '}
                                  <span className="text-[10px] text-gray-400">{h.currency}</span>
                                </td>
                              )}
                              {settings.visibleCols.includes('value') && (
                                <td className="p-4 text-right font-bold text-gray-700">
                                  {currentValBase ? (
                                    <>
                                      {currentValBase.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      <span className="text-[10px] text-gray-400 ml-1 block">{settings.baseCurrency}</span>
                                    </>
                                  ) : '-'}
                                </td>
                              )}
                              {settings.visibleCols.includes('pnl') && (
                                <td className={`p-4 text-right font-bold ${pnlBase && pnlBase >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                  {pnlBase != null ? (
                                    <>
                                      {(pnlBase >= 0 ? '+' : '') + pnlBase.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      <span className="text-[10px] ml-1 opacity-70 block">{settings.baseCurrency}</span>
                                    </>
                                  ) : '-'}
                                </td>
                              )}
                              {settings.visibleCols.includes('weight') && (
                                <td className="p-4 text-right font-bold text-gray-600">{weight.toFixed(2)}%</td>
                              )}
                              {settings.visibleCols.includes('tags') && (
                                <td className="p-4">
                                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                                    {Object.values(h.tags || {}).filter(Boolean).map((t: any, i) => (
                                      <span key={i} className="text-[10px] bg-gray-100 border text-gray-600 px-2 py-0.5 rounded-full">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              )}
                              {settings.visibleCols.includes('action') && (
                                <td className="p-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setTradeForm({
                                          id: h.id, trackType: h.trackType, symbol: h.symbol, name: h.name || h.symbol,
                                          quantity: h.quantity, price: h.costPrice, currency: h.currency,
                                          customPrice: h.customPrice || '', customCurrency: h.customCurrency || h.currency, tags: h.tags || {},
                                        });
                                        setModalType('edit');
                                      }}
                                      className="text-xs bg-white border text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded font-bold transition-colors"
                                    >编辑</button>
                                    <button
                                      onClick={() => {
                                        setSellTarget(h);
                                        setTradeForm({ ...tradeForm, quantity: h.quantity, price: currentPrice || h.costPrice, currency: curCurrency });
                                        setModalType('sell');
                                      }}
                                      className="text-xs bg-white border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded font-bold transition-colors"
                                    >卖出</button>
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
                {holdings.length === 0 && (
                  <div className="text-center py-10 text-gray-400 font-bold">暂无持仓记录，点击右上角“记录买入”开始！</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-gray-500">点亮图表：</span>
              {[
                { id: 'holding', label: '持仓标的' },
                { id: 'currency', label: '结算币种' },
                ...tagGroups.map((g: any) => ({ id: `tag-${g.name}`, label: g.name })),
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAllocDims((prev) => prev.includes(opt.id) ? prev.filter((x) => x !== opt.id) : [...prev, opt.id])}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
                    allocDims.includes(opt.id) ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allocDims.map((dim) => {
                const data = getAllocData(dim);
                const title = dim === 'holding' ? '持仓标的' : dim === 'currency' ? '结算币种' : dim.replace('tag-', '');

                return (
                  <div key={dim} className="bg-white p-6 rounded-xl shadow-sm border h-80 flex flex-col items-center">
                    <h3 className="text-lg font-bold text-gray-700 mb-4 w-full text-center">{title} 分布</h3>
                    {data.length === 0 ? (
                      <div className="text-gray-400 m-auto font-bold flex items-center h-full">暂无数据</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey="value">
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${settings.baseCurrency}`} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-bold mb-6 text-gray-700">总资产历史走势 ({settings.baseCurrency})</h3>
              <div className="h-80">
                {snapshots.length < 2 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed font-bold p-6 text-center">
                    需要至少两天的记录才能绘制折线图，系统会在每天打开时自动记录快照。
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshots}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip
                        formatter={(value: any) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${settings.baseCurrency}`}
                        labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 新增：历史每日变化表 */}
            {enrichedSnapshots.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-5 border-b bg-gray-50">
                  <h3 className="text-lg font-bold text-gray-700">每日资产快照日历</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap text-sm">
                    <thead className="text-gray-500 border-b">
                      <tr>
                        <th className="p-4 font-semibold">记录日期</th>
                        <th className="p-4 font-semibold text-right">总资产 ({settings.baseCurrency})</th>
                        <th className="p-4 font-semibold text-right">较上次变化额</th>
                        <th className="p-4 font-semibold text-right">变化幅度</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {enrichedSnapshots.map((snap) => (
                        <tr key={snap.date} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-700">{snap.date}</td>
                          <td className="p-4 text-right font-bold text-gray-800">
                            {snap.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`p-4 text-right font-bold ${snap.diffAmount > 0 ? 'text-red-500' : snap.diffAmount < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {snap.diffAmount > 0 ? '+' : ''}
                            {snap.diffAmount !== 0 ? snap.diffAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className={`p-4 text-right font-bold ${snap.diffPercent > 0 ? 'text-red-500' : snap.diffPercent < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {snap.diffPercent > 0 ? '+' : ''}
                            {snap.diffPercent !== 0 ? `${snap.diffPercent.toFixed(2)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h3 className="text-lg font-bold mb-4">自定义标签组管理</h3>
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  id="newGroupName"
                  placeholder="新标签组名称 (如: 策略)"
                  className="border rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('newGroupName') as HTMLInputElement;
                    if (input && input.value) {
                      setTagGroups([...tagGroups, { id: Date.now().toString(), name: input.value, values: [] }]);
                      input.value = '';
                    }
                  }}
                  className="bg-blue-100 text-blue-700 px-4 rounded-lg text-sm font-bold hover:bg-blue-200"
                >
                  新建组
                </button>
              </div>
              <div className="space-y-4">
                {tagGroups.map((group: any) => (
                  <div key={group.id} className="p-4 border rounded-lg bg-gray-50 relative">
                    <button
                      onClick={() => setTagGroups(tagGroups.filter((g) => g.id !== group.id))}
                      className="absolute top-2 right-2 text-red-400 text-xs hover:text-red-600 font-bold"
                    >删除组</button>
                    <div className="font-bold text-gray-700 mb-2">{group.name}</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {group.values.map((v: string) => (
                        <span key={v} className="bg-white border text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                          {v}
                          <span
                            className="cursor-pointer text-gray-400 hover:text-red-500 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                            onClick={() => setTagGroups(tagGroups.map((g) => g.id === group.id ? { ...g, values: g.values.filter((val: string) => val !== v) } : g))}
                          >×</span>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="输入新标签名并按回车键..."
                      className="border rounded px-3 py-1.5 text-xs outline-none w-full focus:border-blue-400 transition-colors"
                      onKeyDown={(e) => {
                        const target = e.target as HTMLInputElement;
                        if (e.key === 'Enter' && target.value.trim()) {
                          setTagGroups(tagGroups.map((g) => g.id === group.id ? { ...g, values: [...g.values, target.value.trim()] } : g));
                          target.value = '';
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 弹窗组件 - 保持原有功能，仅在输入框旁增加了 Tooltip */}
      {modalType === 'cash' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-5 border-b bg-gray-50 flex justify-between">
              <h3 className="font-bold text-lg">现金管理</h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 font-bold text-xl hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleCashSubmit} className="p-5 space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button type="button" onClick={() => setTradeForm({ ...tradeForm, cashOp: 'add' })} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${tradeForm.cashOp === 'add' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>存入</button>
                <button type="button" onClick={() => setTradeForm({ ...tradeForm, cashOp: 'sub' })} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${tradeForm.cashOp === 'sub' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>取出</button>
                <button type="button" onClick={() => setTradeForm({ ...tradeForm, cashOp: 'set' })} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${tradeForm.cashOp === 'set' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>设置总额</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{tradeForm.cashOp === 'set' ? '最终金额' : '操作金额'}</label>
                  <input type="number" step="0.01" required className="w-full border rounded-lg p-2 outline-none focus:border-blue-500" value={tradeForm.amount} onChange={(e) => setTradeForm({ ...tradeForm, amount: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">币种</label>
                  <select className="w-full border rounded-lg p-2 bg-gray-50 outline-none" value={tradeForm.currency} onChange={(e) => setTradeForm({ ...tradeForm, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className={`w-full py-2.5 rounded-lg font-bold text-white shadow-sm transition-colors ${tradeForm.cashOp === 'add' ? 'bg-green-600 hover:bg-green-700' : tradeForm.cashOp === 'sub' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                确认{tradeForm.cashOp === 'add' ? '存入' : tradeForm.cashOp === 'sub' ? '取出' : '强制修改为该总额'}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalType === 'edit' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b bg-blue-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-blue-700 flex items-center">
                编辑标的 {tradeForm.symbol}
                <TickerTooltip />
              </h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 font-bold text-xl hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mb-2">修改参数不会导致现金变动，仅用于修正记录和重新分配标签。</div>
              {tradeForm.trackType === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">自定义名称</label>
                  <input type="text" required className="w-full border rounded-lg p-2 outline-none focus:border-blue-500" value={tradeForm.name} onChange={(e) => setTradeForm({ ...tradeForm, name: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">当前持有数量</label>
                  <input type="number" step="0.0001" required className="w-full border rounded-lg p-2 outline-none focus:border-blue-500" value={tradeForm.quantity} onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">平均成本单价</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.01" required className="w-full border rounded-lg p-2 outline-none flex-1 min-w-0 focus:border-blue-500" value={tradeForm.price} onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })} />
                    <select className="border rounded-lg px-1 bg-gray-50 text-xs outline-none" value={tradeForm.currency} onChange={(e) => setTradeForm({ ...tradeForm, currency: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {tradeForm.trackType === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold mb-1 text-yellow-600">当前现价 (手动更新)</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" required className="w-full border border-yellow-300 bg-yellow-50 rounded-lg p-2 outline-none flex-1 focus:border-yellow-500" value={tradeForm.customPrice} onChange={(e) => setTradeForm({ ...tradeForm, customPrice: e.target.value })} />
                    <select className="border border-yellow-300 rounded-lg p-2 bg-yellow-50 outline-none" value={tradeForm.customCurrency} onChange={(e) => setTradeForm({ ...tradeForm, customCurrency: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm font-bold text-gray-700 mb-3">重新分配标签</p>
                <div className="grid grid-cols-2 gap-4">
                  {tagGroups.map((group: any) => (
                    <div key={group.id}>
                      <label className="block text-xs text-gray-500 mb-1">{group.name}</label>
                      <select className="w-full border rounded-lg p-2 text-sm outline-none bg-gray-50" value={tradeForm.tags[group.name] || ''} onChange={(e) => setTradeForm({ ...tradeForm, tags: { ...tradeForm.tags, [group.name]: e.target.value } })}>
                        <option value="">未分类</option>
                        {group.values.map((v: string) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalType(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors">取消</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">确认修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalType === 'sell' && sellTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-5 border-b bg-red-50 flex justify-between">
              <h3 className="font-bold text-lg text-red-600">卖出 {sellTarget.symbol}</h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 font-bold text-xl hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleSellSubmit} className="p-5 space-y-4">
              <div className="text-xs text-gray-500 font-bold bg-gray-50 p-2 rounded">当前持有: {sellTarget.quantity}</div>
              <div>
                <label className="block text-sm font-semibold mb-1">卖出数量</label>
                <div className="flex gap-2">
                  <input type="number" step="0.0001" required className="w-full border rounded-lg p-2 outline-none flex-1 focus:border-red-500" value={tradeForm.quantity} onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })} />
                  <button type="button" onClick={() => setTradeForm({ ...tradeForm, quantity: sellTarget.quantity })} className="bg-gray-100 px-3 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors">全仓</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">成交单价</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" required className="w-full border rounded-lg p-2 outline-none flex-1 focus:border-red-500" value={tradeForm.price} onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })} />
                  <select className="border rounded-lg p-2 bg-gray-50 text-sm outline-none" value={tradeForm.currency} onChange={(e) => setTradeForm({ ...tradeForm, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 rounded-lg font-bold text-white shadow-sm bg-red-600 hover:bg-red-700 transition-colors mt-2">确认卖出 (资金将转入现金)</button>
            </form>
          </div>
        </div>
      )}

      {modalType === 'buy' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-5 border-b bg-blue-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-blue-700">记录买入 {tradeStep === 2 && '- 分配标签'}</h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 font-bold text-xl hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleBuySubmit} className="p-5 max-h-[75vh] overflow-y-auto">
              {tradeStep === 1 ? (
                <div className="space-y-4">
                  <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                    <button type="button" onClick={() => setTradeForm({ ...tradeForm, trackType: 'auto' })} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${tradeForm.trackType === 'auto' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>自动追踪价格</button>
                    <button type="button" onClick={() => setTradeForm({ ...tradeForm, trackType: 'custom' })} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${tradeForm.trackType === 'custom' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>自定义固定标的</button>
                  </div>
                  {tradeForm.trackType === 'auto' ? (
                    <div>
                      <label className="block text-sm font-semibold mb-1 flex items-center">标的代码 <TickerTooltip /></label>
                      <input type="text" required placeholder="如 NVDA 或 0700.HK" className="w-full border rounded-lg p-2 uppercase outline-none focus:border-blue-500" value={tradeForm.symbol} onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value })} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1 flex items-center">代码 <TickerTooltip /></label>
                        <input type="text" required className="w-full border rounded-lg p-2 uppercase outline-none focus:border-blue-500" value={tradeForm.symbol} onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">名称</label>
                        <input type="text" required className="w-full border rounded-lg p-2 outline-none focus:border-blue-500" value={tradeForm.name} onChange={(e) => setTradeForm({ ...tradeForm, name: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">买入数量</label>
                      <input type="number" step="0.0001" required className="w-full border rounded-lg p-2 outline-none focus:border-blue-500" value={tradeForm.quantity} onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">成本单价</label>
                      <div className="flex gap-1">
                        <input type="number" step="0.01" required className="w-full border rounded-lg p-2 outline-none flex-1 min-w-0 focus:border-blue-500" value={tradeForm.price} onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })} />
                        <select className="border rounded-lg px-1 bg-gray-50 text-xs outline-none" value={tradeForm.currency} onChange={(e) => setTradeForm({ ...tradeForm, currency: e.target.value })}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  {tradeForm.trackType === 'custom' && (
                    <div>
                      <label className="block text-sm font-semibold mb-1 text-yellow-600">当前现价 (手动录入)</label>
                      <div className="flex gap-2">
                        <input type="number" step="0.01" required className="w-full border border-yellow-300 bg-yellow-50 rounded-lg p-2 outline-none flex-1 focus:border-yellow-500" value={tradeForm.customPrice} onChange={(e) => setTradeForm({ ...tradeForm, customPrice: e.target.value })} />
                        <select className="border border-yellow-300 rounded-lg p-2 bg-yellow-50 outline-none" value={tradeForm.customCurrency} onChange={(e) => setTradeForm({ ...tradeForm, customCurrency: e.target.value })}>
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setModalType(null)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors">取消</button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">{tagGroups.length > 0 ? '下一步: 选标签' : '确认买入'}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 mb-4">为 <span className="font-bold text-blue-600">{tradeForm.symbol}</span> 贴上标签，方便在饼图里统计。</p>
                  {tagGroups.map((group: any) => (
                    <div key={group.id}>
                      <label className="block text-sm font-semibold mb-1">{group.name}</label>
                      <select className="w-full border rounded-lg p-2 outline-none bg-gray-50" value={tradeForm.tags[group.name] || ''} onChange={(e) => setTradeForm({ ...tradeForm, tags: { ...tradeForm.tags, [group.name]: e.target.value } })}>
                        <option value="">未分类</option>
                        {group.values.map((v: string) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setTradeStep(1)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors">← 上一步</button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">确认买入</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}