'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CashEntry, Holding, TagGroup, Settings,
  Snapshot, PortfolioData, SyncState,
} from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_TAG_GROUPS } from '@/lib/constants';
import { convertToBase, todayStr, isTagsEqual, uid } from '@/lib/utils';

const SYNC_DEBOUNCE_MS = 2000; // 数据变化2秒后自动同步

export function usePortfolio() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [cash, setCash] = useState<CashEntry[]>([{ id: 'c1', currency: 'USD', amount: 0 }]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>(DEFAULT_TAG_GROUPS);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', lastSynced: null, error: null });

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // ── 初始化：先从 Drive 拉取，失败则用 localStorage ──────────────────────────
  useEffect(() => {
    async function init() {
      setSyncState(s => ({ ...s, status: 'syncing' }));
      try {
        const res = await fetch('/api/sync');
        const json = await res.json();
        if (json.exists && json.data) {
          applyData(json.data);
          setSyncState({ status: 'success', lastSynced: json.data._syncedAt || null, error: null });
        } else {
          // Drive上没有数据，尝试从localStorage迁移
          loadFromLocalStorage();
          setSyncState({ status: 'idle', lastSynced: null, error: null });
        }
      } catch {
        // Drive不可用（未配置），降级到localStorage
        loadFromLocalStorage();
        setSyncState({ status: 'error', lastSynced: null, error: 'Drive未配置，使用本地存储' });
      }
      setLoading(false);
      isFirstLoad.current = false;
    }
    init();
  }, []);

  function applyData(data: Partial<PortfolioData>) {
    if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    if (data.cash) setCash(data.cash);
    if (data.holdings) setHoldings(data.holdings);
    if (data.tagGroups) setTagGroups(data.tagGroups);
    if (data.snapshots) setSnapshots(data.snapshots);
  }

  function loadFromLocalStorage() {
    try {
      const savedSet = localStorage.getItem('pf_set');
      if (savedSet) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSet) });
      const savedCash = localStorage.getItem('pf_csh');
      if (savedCash) setCash(JSON.parse(savedCash));
      const savedHld = localStorage.getItem('pf_hld');
      if (savedHld) setHoldings(JSON.parse(savedHld));
      const savedTag = localStorage.getItem('pf_tag');
      if (savedTag) setTagGroups(JSON.parse(savedTag));
      const savedSnp = localStorage.getItem('pf_snp');
      if (savedSnp) setSnapshots(JSON.parse(savedSnp));
    } catch {}
  }

  // ── 数据变化时：同步到 Drive + localStorage ───────────────────────────────
  const currentData = useMemo<PortfolioData>(() => ({
    settings, cash, holdings, tagGroups, snapshots,
  }), [settings, cash, holdings, tagGroups, snapshots]);

  useEffect(() => {
    if (loading || isFirstLoad.current) return;

    // 写 localStorage（兜底）
    localStorage.setItem('pf_set', JSON.stringify(settings));
    localStorage.setItem('pf_csh', JSON.stringify(cash));
    localStorage.setItem('pf_hld', JSON.stringify(holdings));
    localStorage.setItem('pf_tag', JSON.stringify(tagGroups));
    localStorage.setItem('pf_snp', JSON.stringify(snapshots));

    // 防抖写 Drive
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncState(s => ({ ...s, status: 'syncing' }));
      try {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentData),
        });
        const json = await res.json();
        if (json.ok) {
          setSyncState({ status: 'success', lastSynced: new Date().toISOString(), error: null });
        } else throw new Error(json.error);
      } catch (e: any) {
        setSyncState(s => ({ ...s, status: 'error', error: e.message }));
      }
    }, SYNC_DEBOUNCE_MS);
  }, [currentData]);

  // ── 汇率 ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`https://open.er-api.com/v6/latest/${settings.baseCurrency}`)
      .then(r => r.json())
      .then(d => { if (d.rates) setRates(d.rates); })
      .catch(() => {});
  }, [settings.baseCurrency]);

  // ── 总值计算 ──────────────────────────────────────────────────────────────
  const convert = useCallback(
    (amount: number, fromCur: string) => convertToBase(amount, fromCur, settings.baseCurrency, rates),
    [settings.baseCurrency, rates]
  );

  // ── 操作方法 ──────────────────────────────────────────────────────────────
  const addOrMergeBuy = useCallback((
    form: {
      trackType: 'auto' | 'custom'; symbol: string; name: string;
      quantity: number; costPrice: number; currency: string;
      customPrice?: number; customCurrency?: string; tags: Record<string, string>;
    },
    deductCash = true
  ) => {
    const sym = form.symbol.toUpperCase();
    const cost = form.quantity * form.costPrice;

    if (deductCash) {
      setCash(prev => {
        const existing = prev.find(c => c.currency === form.currency);
        if (existing) return prev.map(c => c.currency === form.currency ? { ...c, amount: c.amount - cost } : c);
        return [...prev, { id: uid(), currency: form.currency, amount: -cost }];
      });
    }

    setHoldings(prev => {
      const existing = prev.find(h => h.symbol === sym && isTagsEqual(h.tags, form.tags));
      if (existing) {
        const newQty = existing.quantity + form.quantity;
        const newCost = (existing.quantity * existing.costPrice + cost) / newQty;
        return prev.map(h => h.id === existing.id ? { ...h, quantity: newQty, costPrice: newCost } : h);
      }
      return [...prev, {
        id: uid(), trackType: form.trackType, symbol: sym,
        name: form.name || sym, quantity: form.quantity,
        costPrice: form.costPrice, currency: form.currency,
        customPrice: form.customPrice ?? null,
        customCurrency: form.customCurrency ?? null,
        tags: form.tags,
      }];
    });
  }, []);

  const executeSell = useCallback((
    holdingId: string, quantity: number, price: number, currency: string
  ) => {
    const proceeds = quantity * price;
    setCash(prev => {
      const existing = prev.find(c => c.currency === currency);
      if (existing) return prev.map(c => c.currency === currency ? { ...c, amount: c.amount + proceeds } : c);
      return [...prev, { id: uid(), currency, amount: proceeds }];
    });
    setHoldings(prev =>
      prev.map(h => h.id === holdingId ? { ...h, quantity: h.quantity - quantity } : h)
          .filter(h => h.quantity > 1e-8)
    );
  }, []);

  const updateHolding = useCallback((id: string, patch: Partial<Holding>) => {
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...patch } : h));
  }, []);

  const deleteHolding = useCallback((id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  }, []);

  const updateCash = useCallback((currency: string, amount: number, op: 'add' | 'sub' | 'set') => {
    setCash(prev => {
      const existing = prev.find(c => c.currency === currency);
      const newAmount = op === 'set' ? amount : op === 'add' ? (existing?.amount ?? 0) + amount : Math.max(0, (existing?.amount ?? 0) - amount);
      if (existing) return prev.map(c => c.currency === currency ? { ...c, amount: newAmount } : c);
      return [...prev, { id: uid(), currency, amount: newAmount }];
    });
  }, []);

  // ── 快照（每天记录一次）────────────────────────────────────────────────────
  const recordSnapshot = useCallback((totalValue: number) => {
    if (totalValue <= 0) return;
    const today = todayStr();
    setSnapshots(prev => {
      const exists = prev.find(s => s.date === today);
      if (exists && Math.abs(exists.value - totalValue) < 0.01) return prev;
      const updated = exists
        ? prev.map(s => s.date === today ? { ...s, value: totalValue } : s)
        : [...prev, { date: today, value: totalValue }];
      return updated.slice(-730); // 最多保留2年
    });
  }, []);

  // ── 导入导出 ──────────────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PFTRACK_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentData]);

  const importJSON = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        applyData(data);
      } catch {
        alert('文件格式错误');
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    loading, settings, cash, holdings, tagGroups, snapshots, rates, syncState,
    setSettings, setCash, setHoldings, setTagGroups, setSnapshots,
    convert, addOrMergeBuy, executeSell, updateHolding, deleteHolding,
    updateCash, recordSnapshot, exportJSON, importJSON,
  };
}
