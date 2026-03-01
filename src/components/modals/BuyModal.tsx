'use client';
import React, { useState } from 'react';
import { TagGroup } from '@/types';
import { CURRENCIES } from '@/lib/constants';

interface BuyForm {
  trackType: 'auto' | 'custom';
  symbol: string;
  name: string;
  quantity: number;
  costPrice: number;
  currency: string;
  customPrice?: number;
  customCurrency?: string;
  tags: Record<string, string>;
}

interface Props {
  tagGroups: TagGroup[];
  defaultCurrency: string;
  onClose: () => void;
  onConfirm: (form: BuyForm) => void;
}

const TickerTooltip = () => (
  <div className="relative group cursor-pointer inline-flex ml-1">
    <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">?</span>
    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 bg-gray-800 text-white text-xs p-3 rounded-lg shadow-xl z-50 pointer-events-none">
      <p className="font-bold mb-1 text-blue-300">雅虎财经代码规则：</p>
      <ul className="space-y-1 text-gray-300">
        <li>🇺🇸 美股：直接输入（如 NVDA）</li>
        <li>🇭🇰 港股：代码.HK（如 0700.HK）</li>
        <li>🇯🇵 日股：代码.T（如 9984.T）</li>
        <li>🇨🇳 A股（沪）：代码.SS（如 600519.SS）</li>
        <li>🇨🇳 A股（深）：代码.SZ（如 002594.SZ）</li>
      </ul>
    </div>
  </div>
);

export default function BuyModal({ tagGroups, defaultCurrency, onClose, onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    trackType: 'auto' as 'auto' | 'custom',
    symbol: '',
    name: '',
    quantity: '',
    price: '',
    currency: defaultCurrency,
    customPrice: '',
    customCurrency: defaultCurrency,
    tags: {} as Record<string, string>,
  });

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagGroups.length > 0) { setStep(2); return; }
    submit();
  };

  const submit = () => {
    onConfirm({
      trackType: form.trackType,
      symbol: form.symbol.toUpperCase(),
      name: form.name || form.symbol.toUpperCase(),
      quantity: parseFloat(form.quantity),
      costPrice: parseFloat(form.price),
      currency: form.currency,
      customPrice: form.trackType === 'custom' ? parseFloat(form.customPrice) : undefined,
      customCurrency: form.trackType === 'custom' ? form.customCurrency : undefined,
      tags: form.tags,
    });
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b bg-blue-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-blue-700">
            记录买入{step === 2 && ' — 分配标签'}
          </h3>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold hover:text-gray-600">×</button>
        </div>

        <form onSubmit={step === 1 ? handleStep1 : handleStep2} className="p-5 max-h-[75vh] overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-4">
              {/* 追踪类型 */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['auto', 'custom'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => set({ trackType: t })}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                      form.trackType === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    {t === 'auto' ? '自动追踪价格' : '自定义固定标的'}
                  </button>
                ))}
              </div>

              {/* 代码 / 名称 */}
              {form.trackType === 'auto' ? (
                <div>
                  <label className="block text-sm font-semibold mb-1 flex items-center">
                    标的代码 <TickerTooltip />
                  </label>
                  <input
                    required type="text"
                    placeholder="如 NVDA 或 0700.HK"
                    className="w-full border rounded-lg p-2 uppercase outline-none focus:border-blue-500 text-sm"
                    value={form.symbol}
                    onChange={e => set({ symbol: e.target.value })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1 flex items-center">代码 <TickerTooltip /></label>
                    <input required type="text" className="w-full border rounded-lg p-2 uppercase outline-none focus:border-blue-500 text-sm"
                      value={form.symbol} onChange={e => set({ symbol: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">名称</label>
                    <input required type="text" className="w-full border rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                      value={form.name} onChange={e => set({ name: e.target.value })} />
                  </div>
                </div>
              )}

              {/* 数量 + 成本 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">买入数量</label>
                  <input required type="number" step="0.0001" min="0.0001"
                    className="w-full border rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                    value={form.quantity} onChange={e => set({ quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">成本单价</label>
                  <div className="flex gap-1">
                    <input required type="number" step="0.0001" min="0"
                      className="w-full border rounded-lg p-2 outline-none flex-1 min-w-0 focus:border-blue-500 text-sm"
                      value={form.price} onChange={e => set({ price: e.target.value })} />
                    <select className="border rounded-lg px-1 bg-gray-50 text-xs outline-none"
                      value={form.currency} onChange={e => set({ currency: e.target.value })}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 自定义现价 */}
              {form.trackType === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold mb-1 text-amber-600">当前现价（手动录入）</label>
                  <div className="flex gap-2">
                    <input required type="number" step="0.0001" min="0"
                      className="w-full border border-amber-300 bg-amber-50 rounded-lg p-2 outline-none flex-1 focus:border-amber-400 text-sm"
                      value={form.customPrice} onChange={e => set({ customPrice: e.target.value })} />
                    <select className="border border-amber-300 rounded-lg p-2 bg-amber-50 outline-none text-sm"
                      value={form.customCurrency} onChange={e => set({ customCurrency: e.target.value })}>
                      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm">取消</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 text-sm">
                  {tagGroups.length > 0 ? '下一步：选标签 →' : '确认买入'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                为 <span className="font-bold text-blue-600">{form.symbol.toUpperCase()}</span> 分配标签（可跳过）
              </p>
              {tagGroups.map(g => (
                <div key={g.id}>
                  <label className="block text-sm font-semibold mb-1">{g.name}</label>
                  <select
                    className="w-full border rounded-lg p-2 outline-none bg-gray-50 text-sm"
                    value={form.tags[g.name] || ''}
                    onChange={e => set({ tags: { ...form.tags, [g.name]: e.target.value } })}
                  >
                    <option value="">未分类</option>
                    {g.values.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              ))}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm">← 上一步</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 text-sm">确认买入</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
