/**
 * 文件中心图表公共工具。
 */

import { epColor } from "@/utils/chartTheme";

/**
 * 等容器有非 0 宽高再 init：路由切换过渡动画期间挂载时 DOM 尺寸为 0，
 * echarts init 会报 "Can't get DOM width or height" 且不再自愈。
 * （与 monitor 的 TrendChart 同口径；文件中心有两个图表，抽出来避免各写一份）
 */
export async function waitChartSized(
  el: () => HTMLElement | undefined
): Promise<boolean> {
  for (let i = 0; i < 30; i += 1) {
    const node = el();
    if (node && node.clientWidth > 0 && node.clientHeight > 0) return true;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return false;
}

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
  "#9b59b6"
];

/** 按索引取兜底色（超出色板长度后循环） */
export function fallbackColor(index: number): string {
  const colors = chartFallbackColors();
  return colors[index % colors.length];
}
