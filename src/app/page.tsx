'use client';
import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { usePortfolio } from '@/hooks/usePortfolio';
import { useLiveData } from '@/hooks/useLiveData';
import { convertToBase, formatMoney } from '@/lib/utils';
import { Holding } from '@/types';

import BuyModal  from '@/components/modals/BuyModal';
import SellModal from '@/components/modals/SellModal';
import CashModal from '@/components/modals/CashModal';
import EditModal from '@/components/modals/EditModal';
import AIAssistant from '@/components/AIAssistant';

const HoldingsTab   = dynamic(() => import('@/components/HoldingsTab'));
const AllocationTab = dynamic(() => import('@/components/AllocationTab'));
const TimelineTab   = dynamic(() => import('@/components/TimelineTab'));
const SettingsTab   = dynamic(() => import('@/components/SettingsTab'));

const TABS = [
  { id: 'holdings',   label: '持仓一览' },
  { id: 'allocation', label: '资产分布' },
  { id: 'timeline',   label: '历史走势' },
  { id: 'settings',   label: '设置与数据' },
];

// ── 密码锁屏 ────────────────────────────────────────────────────
const APP_PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD;

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (pwd === APP_PASSWORD) {
      sessionStorage.setItem('pf_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setPwd('');
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-80 border">
        <h1 className="text-2xl font-black text-blue-600 mb-1">
          PF<span className="text-gray-800">TRACK</span>
        </h1>
        <p className="text-xs text-gray-400 mb-6">Personal Portfolio Tracker</p>

        <div className="space-y-3">
          <input
            type="password"
            placeholder="请输入访问密码"
            className={`w-full border rounded-xl p-3 outline-none text-sm transition-colors ${
              error ? 'border-red-400 bg-red-50' : 'focus:border-blue-500'
            }`}
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
          />
          {error && <p className="text-xs text-red-500 font-bold">密码错误，请重试</p>}
          <button
            onClick={submit}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm"
          >
            进入
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主应用 ───────────────────────────────────────────────────────
export default function Page() {
  const [unlocked, setUnlocked] = useState(false);

  // 密码检查：本次 session 内已解锁则跳过
  useEffect(() => {
    if (!APP_PASSWORD || sessionStorage.getItem('pf_unlocked') === '1') {
      setUnlocked(true);
    }
  }, []);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return <AppContent />;
}

function AppContent() {
  const portfolio = usePortfolio();
  const { liveData, isFetching, refreshAll } = useLiveData(portfolio.holdings);

  const [activeTab, setActiveTab] = useState('holdings');
  const [modal, setModal] = useState<string | null>(null);
  const [sellTarget, setSellTarget] = useState<Holding | null>(null);
  const [editTarget, setEditTarget] = useState<Holding | null>(null);

  const convert = (amount: number, cur: string) =>
    convertToBase(amount, cur, portfolio.settings.baseCurrency, portfolio.rates);

  const totalValue = useMemo(() => {
    const cashTotal = portfolio.cash.reduce((s, c) => s + convert(c.amount, c.currency), 0);
    const holdingsTotal = portfolio.holdings.reduce((s, h) => {
      const live = liveData[h.symbol];
      if (h.trackType === 'auto' && (!live || live.error)) return s;
      const p = h.trackType === 'auto' ? live!.price : (h.customPrice ?? 0);
      const c = h.trackType === 'auto' ? live!.currency : (h.customCurrency ?? h.currency);
      return s + convert(p * h.quantity, c);
    }, 0);
    return cashTotal + holdingsTotal;
  }, [portfolio.cash, portfolio.holdings, liveData, portfolio.settings.baseCurrency, portfolio.rates]);

  useEffect(() => {
    portfolio.recordSnapshot(totalValue);
  }, [totalValue]);

  const { syncState } = portfolio;

  if (portfolio.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm px-4 md:px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg md:text-xl font-black text-blue-600">
            PF<span className="text-gray-800">TRACK</span>
          </h1>
          <div className="flex items-center gap-1 mt-0.5">
            {syncState.status === 'syncing' && <span className="text-[10px] text-blue-400 animate-pulse">● 同步中…</span>}
            {syncState.status === 'success' && <span className="text-[10px] text-emerald-500">● 已同步</span>}
            {syncState.status === 'error'   && <span className="text-[10px] text-amber-500" title={syncState.error ?? ''}>● 本地存储</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl md:text-2xl font-bold">{formatMoney(totalValue, portfolio.settings.precision)}</div>
          <div className="text-xs text-gray-400 font-bold">总资产 ({portfolio.settings.baseCurrency})</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white px-4 md:px-6 flex border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`py-3 px-2 md:px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {activeTab === 'holdings' && (
          <HoldingsTab
            holdings={portfolio.holdings} cash={portfolio.cash}
            settings={portfolio.settings} rates={portfolio.rates}
            liveData={liveData} isFetching={isFetching}
            totalValue={totalValue} tagGroups={portfolio.tagGroups}
            onAddBuy={() => setModal('buy')} onCash={() => setModal('cash')}
            onEdit={h => { setEditTarget(h); setModal('edit'); }}
            onSell={h => { setSellTarget(h); setModal('sell'); }}
            onSettingsChange={patch => portfolio.setSettings(s => ({ ...s, ...patch }))}
            onRefresh={refreshAll}
          />
        )}
        {activeTab === 'allocation' && (
          <AllocationTab
            holdings={portfolio.holdings} cash={portfolio.cash}
            settings={portfolio.settings} rates={portfolio.rates}
            liveData={liveData} totalValue={totalValue}
            tagGroups={portfolio.tagGroups}
            onSettingsChange={patch => portfolio.setSettings(s => ({ ...s, ...patch }))}
          />
        )}
        {activeTab === 'timeline' && (
          <TimelineTab snapshots={portfolio.snapshots} settings={portfolio.settings}
            onSettingsChange={patch => portfolio.setSettings(s => ({ ...s, ...patch }))} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={portfolio.settings} tagGroups={portfolio.tagGroups}
            onSettingsChange={patch => portfolio.setSettings(s => ({ ...s, ...patch }))}
            onTagGroupsChange={portfolio.setTagGroups}
            onExport={portfolio.exportJSON} onImport={portfolio.importJSON}
            syncState={portfolio.syncState}
          />
        )}
      </div>

      {/* 弹窗 */}
      {modal === 'buy' && (
        <BuyModal tagGroups={portfolio.tagGroups} defaultCurrency={portfolio.settings.baseCurrency}
          onClose={() => setModal(null)}
          onConfirm={form => { portfolio.addOrMergeBuy(form); setModal(null); }} />
      )}
      {modal === 'sell' && sellTarget && (
        <SellModal holding={sellTarget} liveData={liveData} defaultCurrency={portfolio.settings.baseCurrency}
          onClose={() => { setModal(null); setSellTarget(null); }}
          onConfirm={(qty, price, cur) => { portfolio.executeSell(sellTarget.id, qty, price, cur); setModal(null); setSellTarget(null); }} />
      )}
      {modal === 'cash' && (
        <CashModal defaultCurrency={portfolio.settings.baseCurrency}
          onClose={() => setModal(null)}
          onConfirm={(cur, amt, op) => { portfolio.updateCash(cur, amt, op); setModal(null); }} />
      )}
      {modal === 'edit' && editTarget && (
        <EditModal holding={editTarget} tagGroups={portfolio.tagGroups}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onConfirm={patch => { portfolio.updateHolding(editTarget.id, patch); setModal(null); setEditTarget(null); }} />
      )}

      {/* AI 助手悬浮按钮 */}
      <AIAssistant
        holdings={portfolio.holdings}
        cash={portfolio.cash}
        liveData={liveData}
        settings={portfolio.settings}
        rates={portfolio.rates}
        totalValue={totalValue}
      />
    </div>
  );
}
