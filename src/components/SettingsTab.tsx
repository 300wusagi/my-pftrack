'use client';
import React, { useRef, useState } from 'react';
import { Settings, TagGroup, SyncState } from '@/types';
import { CURRENCIES } from '@/lib/constants';

interface Props {
  settings: Settings;
  tagGroups: TagGroup[];
  syncState: SyncState;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onTagGroupsChange: (groups: TagGroup[]) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function SettingsTab({
  settings, tagGroups, syncState,
  onSettingsChange, onTagGroupsChange, onExport, onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    onTagGroupsChange([...tagGroups, { id: Date.now().toString(), name, values: [] }]);
    setNewGroupName('');
  };

  const removeGroup = (id: string) => {
    onTagGroupsChange(tagGroups.filter(g => g.id !== id));
  };

  const addTagValue = (groupId: string, value: string) => {
    onTagGroupsChange(tagGroups.map(g =>
      g.id === groupId ? { ...g, values: [...g.values, value] } : g
    ));
  };

  const removeTagValue = (groupId: string, value: string) => {
    onTagGroupsChange(tagGroups.map(g =>
      g.id === groupId ? { ...g, values: g.values.filter(v => v !== value) } : g
    ));
  };

  const syncStatusText = {
    idle: '未配置 Drive，使用本地存储',
    syncing: '同步中…',
    success: `已同步至 Google Drive${syncState.lastSynced ? `（${new Date(syncState.lastSynced).toLocaleString()}）` : ''}`,
    error: syncState.error ?? '同步出错',
  }[syncState.status];

  const syncStatusColor = {
    idle: 'text-gray-400',
    syncing: 'text-blue-400',
    success: 'text-emerald-600',
    error: 'text-amber-500',
  }[syncState.status];

  return (
    <div className="grid md:grid-cols-2 gap-6">

      {/* ── 基础设置 ── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-base font-bold mb-5 border-b pb-2">基础设置</h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">全局基础货币</label>
            <select
              className="w-full border rounded-lg p-2.5 outline-none bg-gray-50 focus:border-blue-500 font-bold text-sm"
              value={settings.baseCurrency}
              onChange={e => onSettingsChange({ baseCurrency: e.target.value })}
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">显示精度</label>
            <select
              className="w-full border rounded-lg p-2.5 outline-none bg-gray-50 focus:border-blue-500 text-sm"
              value={settings.precision ?? 2}
              onChange={e => onSettingsChange({ precision: parseInt(e.target.value) })}
            >
              <option value={0}>整数（如 100）</option>
              <option value={1}>1位小数（如 100.1）</option>
              <option value={2}>2位小数（如 100.12）</option>
              <option value={3}>3位小数（如 100.123）</option>
              <option value={4}>4位小数（如 100.1234）</option>
            </select>
            <p className="text-xs text-gray-400 mt-1.5">仅影响汇总金额显示，不影响单价和数量精度</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">盈亏配色</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => onSettingsChange({ colorMode: 'intl' })}
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                  settings.colorMode !== 'cn' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🌍 绿涨红跌（国际）
              </button>
              <button
                type="button"
                onClick={() => onSettingsChange({ colorMode: 'cn' })}
                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${
                  settings.colorMode === 'cn' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🇨🇳 红涨绿跌（中国）
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 数据与同步 ── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-base font-bold mb-5 border-b pb-2">数据与同步</h3>

        {/* 同步状态 */}
        <div className="mb-5 p-3 bg-gray-50 rounded-lg border">
          <div className="text-xs font-bold text-gray-500 mb-1">云端同步状态</div>
          <div className={`text-sm font-bold ${syncStatusColor}`}>
            {syncState.status === 'syncing' && <span className="animate-pulse">● </span>}
            {syncState.status !== 'syncing' && '● '}
            {syncStatusText}
          </div>
          {syncState.status === 'error' && (
            <div className="text-xs text-gray-400 mt-1">
              参考 <code className="bg-gray-100 px-1 rounded">GOOGLE_DRIVE_SETUP.md</code> 配置 Drive 同步
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          数据保存在浏览器本地 + Google Drive（如已配置）。
          也可手动导出 JSON 备份，在其他设备导入恢复。
        </p>

        <div className="flex gap-3">
          <button
            onClick={onExport}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors text-sm"
          >
            ⬇️ 导出备份
          </button>
          <input
            type="file" accept=".json"
            ref={fileInputRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-white border text-gray-700 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition-colors text-sm"
          >
            ⬆️ 导入备份
          </button>
        </div>
      </div>

      {/* ── 标签组管理 ── */}
      <div className="bg-white p-6 rounded-xl shadow-sm border md:col-span-2">
        <h3 className="text-base font-bold mb-4">自定义标签组</h3>

        {/* 新建组 */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="新标签组名称（如：策略、风格…）"
            className="border rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-blue-500 transition-colors"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
          />
          <button
            onClick={addGroup}
            className="bg-blue-100 text-blue-700 px-4 rounded-lg text-sm font-bold hover:bg-blue-200 transition-colors"
          >
            + 新建组
          </button>
        </div>

        {/* 标签组列表 */}
        <div className="grid md:grid-cols-2 gap-4">
          {tagGroups.map(group => (
            <div key={group.id} className="p-4 border rounded-xl bg-gray-50 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-gray-700">{group.name}</span>
                <button
                  onClick={() => removeGroup(group.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-bold px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  删除组
                </button>
              </div>

              {/* 标签值 */}
              <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
                {group.values.map(v => (
                  <span key={v} className="bg-white border text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium text-gray-700">
                    {v}
                    <button
                      onClick={() => removeTagValue(group.id, v)}
                      className="text-gray-300 hover:text-red-500 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors ml-0.5 text-sm leading-none"
                    >×</button>
                  </span>
                ))}
                {group.values.length === 0 && (
                  <span className="text-xs text-gray-400">暂无标签值，输入后按回车添加</span>
                )}
              </div>

              {/* 添加新值 */}
              <input
                type="text"
                placeholder="输入新标签值，按回车确认…"
                className="border rounded-lg px-3 py-1.5 text-xs outline-none w-full focus:border-blue-400 transition-colors bg-white"
                onKeyDown={e => {
                  const el = e.target as HTMLInputElement;
                  if (e.key === 'Enter' && el.value.trim()) {
                    addTagValue(group.id, el.value.trim());
                    el.value = '';
                  }
                }}
              />
            </div>
          ))}
        </div>

        {tagGroups.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            暂无标签组。创建标签组后可在持仓页对标的进行分类，并在资产分布页按标签查看饼图。
          </div>
        )}
      </div>
    </div>
  );
}
