'use client';
import React, { useState } from 'react';
import { CURRENCIES } from '@/lib/constants';

interface Props {
  defaultCurrency: string;
  onClose: () => void;
  onConfirm: (currency: string, amount: number, op: 'add' | 'sub' | 'set') => void;
}

export default function CashModal({ defaultCurrency, onClose, onConfirm }: Props) {
  const [op, setOp] = useState<'add' | 'sub' | 'set'>('add');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onConfirm(currency, amt, op);
  };

  const opConfig = {
    add: { label: '存入', btnClass: 'bg-emerald-600 hover:bg-emerald-700', activeClass: 'bg-white shadow-sm text-emerald-600' },
    sub: { label: '取出', btnClass: 'bg-red-600 hover:bg-red-700',     activeClass: 'bg-white shadow-sm text-red-500'    },
    set: { label: '强制设置总额', btnClass: 'bg-blue-600 hover:bg-blue-700', activeClass: 'bg-white shadow-sm text-blue-600' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-lg">现金管理</h3>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold hover:text-gray-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 操作类型 */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(['add', 'sub', 'set'] as const).map(o => (
              <button
                key={o} type="button"
                onClick={() => setOp(o)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  op === o ? opConfig[o].activeClass : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {o === 'add' ? '存入' : o === 'sub' ? '取出' : '设置总额'}
              </button>
            ))}
          </div>

          {/* 金额 + 币种 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">
                {op === 'set' ? '最终金额' : '操作金额'}
              </label>
              <input
                required type="number" step="0.01" min="0"
                className="w-full border rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">币种</label>
              <select
                className="w-full border rounded-lg p-2 bg-gray-50 outline-none text-sm"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {op === 'set' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">
              此操作会将该币种现金直接设置为输入金额，不影响其他币种。
            </p>
          )}

          <button
            type="submit"
            className={`w-full py-2.5 rounded-lg font-bold text-white text-sm transition-colors ${opConfig[op].btnClass}`}
          >
            确认{opConfig[op].label}
          </button>
        </form>
      </div>
    </div>
  );
}
