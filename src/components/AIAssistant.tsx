'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Holding, LiveQuote, Settings } from '@/types';
import { formatMoney, convertToBase } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  holdings: Holding[];
  cash: { id: string; currency: string; amount: number }[];
  liveData: Record<string, LiveQuote>;
  settings: Settings;
  rates: Record<string, number>;
  totalValue: number;
}

// 快捷问题
const QUICK_QUESTIONS = [
  '分析我的持仓集中度风险',
  '我的行业分散度如何？',
  '哪些持仓盈亏表现最好/最差？',
  '我的现金比例合理吗？',
];

function buildPortfolioContext(
  holdings: Holding[],
  cash: { id: string; currency: string; amount: number }[],
  liveData: Record<string, LiveQuote>,
  settings: Settings,
  rates: Record<string, number>,
  totalValue: number,
): string {
  const convert = (amount: number, cur: string) =>
    convertToBase(amount, cur, settings.baseCurrency, rates);

  const lines: string[] = [];
  lines.push(`基础货币：${settings.baseCurrency}`);
  lines.push(`总资产：${formatMoney(totalValue, 2)} ${settings.baseCurrency}`);
  lines.push('');

  // 现金
  lines.push('【现金】');
  cash.forEach(c => {
    lines.push(`  ${c.currency}: ${formatMoney(c.amount, 2)}（折合 ${formatMoney(convert(c.amount, c.currency), 2)} ${settings.baseCurrency}）`);
  });
  lines.push('');

  // 持仓
  lines.push('【持仓明细】');
  holdings.forEach(h => {
    const live = liveData[h.symbol];
    const isAuto = h.trackType === 'auto';
    const price = isAuto ? (live?.price ?? null) : h.customPrice;
    const currency = isAuto ? (live?.currency ?? h.currency) : (h.customCurrency ?? h.currency);
    const valueBase = price != null ? convert(price * h.quantity, currency) : null;
    const costBase = convert(h.costPrice * h.quantity, h.currency);
    const pnl = valueBase != null ? valueBase - costBase : null;
    const pnlPct = pnl != null && costBase > 0 ? (pnl / costBase * 100) : null;
    const weight = valueBase != null && totalValue > 0 ? (valueBase / totalValue * 100) : null;

    const tags = Object.entries(h.tags || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');

    lines.push(`  ${h.symbol} (${h.name})`);
    lines.push(`    数量: ${h.quantity} | 成本: ${h.costPrice} ${h.currency}`);
    if (price != null) {
      lines.push(`    现价: ${price} ${currency} | 总现值: ${formatMoney(valueBase!, 2)} ${settings.baseCurrency}`);
    } else {
      lines.push(`    现价: 获取失败`);
    }
    if (pnl != null) {
      lines.push(`    盈亏: ${pnl >= 0 ? '+' : ''}${formatMoney(pnl, 2)} (${pnlPct?.toFixed(2)}%)`);
    }
    if (weight != null) lines.push(`    占比: ${weight.toFixed(2)}%`);
    if (tags) lines.push(`    标签: ${tags}`);
    lines.push('');
  });

  return lines.join('\n');
}

export default function AIAssistant({
  holdings, cash, liveData, settings, rates, totalValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的投资组合分析助手。我已经读取了你的持仓数据，可以帮你分析集中度、盈亏结构、行业分散度等。有什么想了解的？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const portfolioContext = buildPortfolioContext(
        holdings, cash, liveData, settings, rates, totalValue
      );

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          portfolioContext,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，分析出错了，请稍后再试。' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '网络错误，请稍后再试。' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center text-2xl transition-all hover:scale-110"
        title="AI 投资助手"
      >
        🤖
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 md:p-6 pointer-events-none">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border flex flex-col pointer-events-auto"
            style={{ height: '70vh', maxHeight: 600 }}>

            {/* 顶栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-600 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div>
                  <div className="text-white font-bold text-sm">AI 投资助手</div>
                  <div className="text-blue-200 text-[10px]">基于你的实时持仓数据分析</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
              >×</button>
            </div>

            {/* 消息区 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">🤖</div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm mr-2 flex-shrink-0">🤖</div>
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 快捷问题 */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-[11px] bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 输入框 */}
            <div className="px-3 pb-3 pt-2 border-t">
              <div className="flex gap-2 bg-gray-50 border rounded-xl px-3 py-2">
                <input
                  type="text"
                  placeholder="问我任何关于你持仓的问题…"
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                  disabled={loading}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="text-blue-600 font-bold text-sm px-2 disabled:opacity-30 hover:text-blue-700 transition-colors"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
