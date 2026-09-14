import type { DashboardCard } from "@/api/system/datasets";

/**
 * 卡片宽度换算：存储值按 12 栅格档位（表单文案 `${span}/12`，类型 3|6|9|12），
 * 而 el-col 用 24 栅格——此前直接把 12 栅格值传给 el-col，所有卡片实渲染宽度
 * 只有标称的一半（如「12/12 全宽」实为半宽），此处换算并钳制上限。
 */
export const cardColSpan = (card: Pick<DashboardCard, "span">) =>
  Math.min((card.span ?? 6) * 2, 24);

/** 窄屏（<1200px）最多两列：避免 990-1280 中屏四列图表挤压（R8）。 */
export const cardColSpanNarrow = (card: Pick<DashboardCard, "span">) =>
  Math.min(cardColSpan(card), 12);
