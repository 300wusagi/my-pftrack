'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Holding, LiveQuote } from '@/types';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5分钟自动刷新

export function useLiveData(holdings: Holding[]) {
  const [liveData, setLiveData] = useState<Record<string, LiveQuote>>({});
  const [fetchingSet, setFetchingSet] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSymbol = useCallback(async (symbol: string) => {
    setFetchingSet(prev => new Set([...prev, symbol]));
    try {
      const res = await fetch(`/api/quote?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(prev => ({
          ...prev,
          [symbol]: {
            price: data.price,
            currency: data.currency,
            name: data.name,
            previousClose: data.previousClose,
            changePercent: data.changePercent,
          },
        }));
      } else {
        setLiveData(prev => ({ ...prev, [symbol]: { price: 0, currency: 'USD', name: symbol, error: true } }));
      }
    } catch {
      setLiveData(prev => ({ ...prev, [symbol]: { price: 0, currency: 'USD', name: symbol, error: true } }));
    } finally {
      setFetchingSet(prev => { const s = new Set(prev); s.delete(symbol); return s; });
    }
  }, []);

  const refreshAll = useCallback(() => {
    const autoHoldings = holdings.filter(h => h.trackType === 'auto');
    autoHoldings.forEach(h => fetchSymbol(h.symbol));
  }, [holdings, fetchSymbol]);

  // 持仓变化时获取新标的
  useEffect(() => {
    const autoSymbols = holdings.filter(h => h.trackType === 'auto').map(h => h.symbol);
    const missing = autoSymbols.filter(sym => !liveData[sym] && !fetchingSet.has(sym));
    missing.forEach(sym => fetchSymbol(sym));
  }, [holdings]);

  // 5分钟定时刷新
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(refreshAll, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refreshAll]);

  const isFetching = (symbol: string) => fetchingSet.has(symbol);

  return { liveData, isFetching, refreshAll };
}
