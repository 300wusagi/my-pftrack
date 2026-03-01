export interface CashEntry {
  id: string;
  currency: string;
  amount: number;
}

export interface Holding {
  id: string;
  trackType: 'auto' | 'custom';
  symbol: string;
  name: string;
  quantity: number;
  costPrice: number;
  currency: string;
  customPrice?: number | null;
  customCurrency?: string | null;
  tags: Record<string, string>;
}

export interface TagGroup {
  id: string;
  name: string;
  values: string[];
}

export interface Snapshot {
  date: string;
  value: number;
  diffAmount?: number;
  diffPercent?: number;
}

export interface Settings {
  baseCurrency: string;
  visibleCols: string[];
  precision: number;
  colorMode: 'intl' | 'cn'; // 国际（绿涨红跌）or 中国（红涨绿跌）
  holdingsGroupBy: string | null;
  allocDims: string[];
  timelineRange: string;
}

export interface LiveQuote {
  price: number;
  currency: string;
  name: string;
  previousClose?: number;
  changePercent?: number;
  error?: boolean;
}

export interface PortfolioData {
  settings: Settings;
  cash: CashEntry[];
  holdings: Holding[];
  tagGroups: TagGroup[];
  snapshots: Snapshot[];
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSynced: string | null;
  error: string | null;
}
