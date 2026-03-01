import { Settings, TagGroup } from '@/src/types';

export const CURRENCIES = [
  'USD', 'HKD', 'JPY', 'CNY', 'EUR', 'GBP',
  'KRW', 'AUD', 'CAD', 'SGD', 'TWD', 'VND', 'INR', 'CHF',
];

export const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#6366f1', '#a855f7',
];

export const COL_OPTIONS = [
  { id: 'symbol',   label: '标的'     },
  { id: 'quantity', label: '数量'     },
  { id: 'price',    label: '现价'     },
  { id: 'cost',     label: '成本单价' },
  { id: 'value',    label: '总现值'   },
  { id: 'pnl',      label: '总盈亏'   },
  { id: 'dayChange',label: '前日比'   },
  { id: 'weight',   label: '占比'     },
  { id: 'tags',     label: '标签'     },
  { id: 'action',   label: '操作'     },
];

export const TIMELINE_RANGES = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'USD',
  visibleCols: COL_OPTIONS.map((c) => c.id),
  precision: 2,
  colorMode: 'intl',
  holdingsGroupBy: null,
  allocDims: ['holding'],
  timelineRange: '3M',
};

export const DEFAULT_TAG_GROUPS: TagGroup[] = [
  { id: 'g1', name: '板块', values: ['科技', '金融', '医疗', '能源', '消费', '工业'] },
  { id: 'g2', name: '券商', values: ['Moomoo', '乐天', '盈透', '老虎'] },
  { id: 'g3', name: '地区', values: ['美股', '港股', '日股', 'A股', '欧洲'] },
];

// Google Drive中存储的文件名
export const DRIVE_FILE_NAME = 'pftrack_data.json';
