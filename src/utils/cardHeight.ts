/**
 * 仪表盘卡片高度口径（仪表盘页 / 大屏设计器 / 投屏页共用单一来源）。
 *
 * 缺省 224 与存量 `h-56` 渲染一致：卡片未配置 `height` 时按此回退，保证
 * 「仪表盘所见 = 大屏所得」（大屏与仪表盘共用同一份卡片布局）。
 */
export const DEFAULT_CARD_HEIGHT = 224;

/** 表单可选高度档位（px）：标准档位即缺省值 */
export const CARD_HEIGHT_OPTIONS = [
  160,
  DEFAULT_CARD_HEIGHT,
  320,
  440
] as const;

/** 卡片渲染高度：未配置（缺省/空值）回退 DEFAULT_CARD_HEIGHT */
export const cardRenderHeight = (height?: number) =>
  height ?? DEFAULT_CARD_HEIGHT;
