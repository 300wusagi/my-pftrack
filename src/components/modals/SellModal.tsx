'use client';
import React, { useState } from 'react';
import { Holding, LiveQuote } from '@/types';
import { CURRENCIES } from '@/lib/constants';
import { formatMoney } from '@/lib/utils';

interface Props {
  holding: Holding;
  liveData: Record<string, LiveQuote>;
  defaultCurrency: string;
  onClose: () => void;
  onConfirm: (quantity: number, price: number, currency: string) => void;
}

export default function SellModal({ holding, liveData, defaultCurrency, onClose, onConfirm }: Props) {
  const live = liveData[holding.symbol];
  const suggestedPrice = live?.price ?? holding.customPrice ?? holding.costPrice;
  const suggestedCurrency = live?.currency ?? holding.customCurrency ?? holding.currency ?? defaultCurrency;

  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(String(suggestedPrice ?? ''));
  const [currency, setCurrency] = useState(suggestedCurrency);
  const [error, setError] = useState('');

  const qty = parseFloat(quantity);
  const prc = parseFloat(price);
  const proceeds = (!isNaN(qty) && !isNaN(prc)) ? qty * prc : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!qty || qty <= 0) { setError('请输入有效数量'); return; }
    if (!prc || prc <= 0) { setError('请输入有效价格'); return; }
    if (qty > holding.quantity) { setError(`最多可卖出 ${holding.quantity}`); return; }
    onConfirm(qty, prc, currency);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b bg-red-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-red-600">卖出 {holding.symbol}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-xs font-bold bg-gray-50 border rounded-lg p-2.5 text-gray-500">
            当前持有：<span className="text-gray-800">{holding.quantity}</span> 股/份
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-sm font-semibold mb-1">卖出数量</label>
            <div className="flex gap-2">
              <input
                required type="number" step="0.0001" min="0.0001"
                className="w-full border rounded-lg p-2 outline-none flex-1 focus:border-red-400 text-sm"
                placeholder={`最多 ${holding.quantity}`}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setQuantity(String(holding.quantity))}
                className="bg-gray-100 px-3 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-200"
              >
                全仓
              </button>
            </div>
          </div>

          {/* 成交价格 */}
          <div>
            <label className="block text-sm font-semibold mb-1">成交单价</label>
            <div className="flex gap-2">
              <input
                required type="number" step="0.0001" min="0"
                className="w-full border rounded-lg p-2 outline-none flex-1 focus:border-red-400 text-sm"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
              <select
                className="border rounded-lg p-2 bg-gray-50 text-sm outline-none"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* 预计收回 */}
          {proceeds != null && proceeds > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-0.5">预计收回</div>
              <div className="text-base font-bold text-emerald-600">
                {formatMoney(proceeds, 2)} {currency}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">卖出后将自动计入 {currency} 现金</div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 font-bold">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm">取消</button>
            <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 text-sm">确认卖出</button>
          </div>
        </form>
      </div>
    </div>
  );
}
