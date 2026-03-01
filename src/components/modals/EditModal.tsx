'use client';
import React, { useState } from 'react';
import { Holding, TagGroup } from '@/types';
import { CURRENCIES } from '@/lib/constants';

interface Props {
  holding: Holding;
  tagGroups: TagGroup[];
  onClose: () => void;
  onConfirm: (patch: Partial<Holding>) => void;
}

export default function EditModal({ holding, tagGroups, onClose, onConfirm }: Props) {
  const [form, setForm] = useState({
    name: holding.name || holding.symbol,
    quantity: String(holding.quantity),
    costPrice: String(holding.costPrice),
    currency: holding.currency,
    customPrice: String(holding.customPrice ?? ''),
    customCurrency: holding.customCurrency ?? holding.currency,
    tags: { ...(holding.tags || {}) },
  });

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      name: form.name,
      quantity: parseFloat(form.quantity),
      costPrice: parseFloat(form.costPrice),
      currency: form.currency,
      customPrice: holding.trackType === 'custom' ? (parseFloat(form.customPrice) || undefined) : holding.customPrice,
      customCurrency: holding.trackType === 'custom' ? form.customCurrency : holding.customCurrency,
      tags: form.tags,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b bg-blue-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-blue-700">编辑 {holding.symbol}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          <p className="text-xs text-gray-400 bg-gray-50 border rounded-lg p-2.5">
            修改参数不会触发现金变动，仅用于修正记录。如需调整持仓，请使用买入/卖出。
          </p>

          {/* 自定义名称（仅custom类型） */}
          {holding.trackType === 'custom' && (
            <div>
              <label className="block text-sm font-semibold mb-1">标的名称</label>
              <input
                required type="text"
                className="w-full border rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                value={form.name}
                onChange={e => set({ name: e.target.value })}
              />
            </div>
          )}

          {/* 数量 + 成本 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">持有数量</label>
              <input
                required type="number" step="0.0001" min="0.0001"
                className="w-full border rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                value={form.quantity}
                onChange={e => set({ quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">平均成本单价</label>
              <div className="flex gap-1">
                <input
                  required type="number" step="0.0001" min="0"
                  className="w-full border rounded-lg p-2 outline-none flex-1 min-w-0 focus:border-blue-500 text-sm"
                  value={form.costPrice}
                  onChange={e => set({ costPrice: e.target.value })}
                />
                <select
                  className="border rounded-lg px-1 bg-gray-50 text-xs outline-none"
                  value={form.currency}
                  onChange={e => set({ currency: e.target.value })}
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 自定义现价（仅custom类型） */}
          {holding.trackType === 'custom' && (
            <div>
              <label className="block text-sm font-semibold mb-1 text-amber-600">当前现价（手动更新）</label>
              <div className="flex gap-2">
                <input
                  required type="number" step="0.0001" min="0"
                  className="w-full border border-amber-300 bg-amber-50 rounded-lg p-2 outline-none flex-1 focus:border-amber-400 text-sm"
                  value={form.customPrice}
                  onChange={e => set({ customPrice: e.target.value })}
                />
                <select
                  className="border border-amber-300 rounded-lg p-2 bg-amber-50 outline-none text-sm"
                  value={form.customCurrency}
                  onChange={e => set({ customCurrency: e.target.value })}
                >
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 标签重新分配 */}
          {tagGroups.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm font-bold text-gray-600 mb-3">重新分配标签</p>
              <div className="grid grid-cols-2 gap-3">
                {tagGroups.map(g => (
                  <div key={g.id}>
                    <label className="block text-xs text-gray-500 mb-1">{g.name}</label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm outline-none bg-gray-50 focus:border-blue-500"
                      value={form.tags[g.name] || ''}
                      onChange={e => set({ tags: { ...form.tags, [g.name]: e.target.value } })}
                    >
                      <option value="">未分类</option>
                      {g.values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm">取消</button>
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 text-sm">确认修改</button>
          </div>
        </form>
      </div>
    </div>
  );
}
