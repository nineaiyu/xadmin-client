/**
 * 文件中心图表公共工具。
 */

import { CHART_ACCENT, epColor } from "@/utils/chartTheme";

// 容器尺寸等待已下沉到共享工具（monitor/dashboard 等图表共用），此处薄转发保持调用面
export { waitChartSized } from "@/utils/chart";

/**
 * 分类色板兜底：字典项未配置 color 时按序取色（与字典页展示色系一致）。
 * EP 语义色经 CSS 变量读取（跟随主题），末位紫为图表专用色；调用时求值。
 */
export const chartFallbackColors = (): string[] => [
  epColor("primary"),
  epColor("success"),
  epColor("warning"),
  epColor("info"),
  epColor("danger"),
  CHART_ACCENT
];

/** 按索引取兜底色（超出色板长度后循环） */
export function fallbackColor(index: number): string {
  const colors = chartFallbackColors();
  return colors[index % colors.length];
}
