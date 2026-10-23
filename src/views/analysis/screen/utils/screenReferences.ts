import type { ScreenItem } from "@/api/dataset/analysis";
import { readFreeLayout } from "./freeLayout";

/**
 * 大屏引用的仪表盘主键全集：轮播清单 `dashboards` ∪ 栅格/自由画布窗格引用。
 *
 * 画布窗格的 `dashboard` 引用不一定出现在 `dashboards` 清单里（设计器可直接挂仪表盘，
 * 列表页编辑也可能移除清单项而窗格仍引用）。展示端只按清单装载仪表盘会让这些窗格
 * 被可见性过滤整格丢掉（页面空白），因此装载时按并集取数。
 */
export function referencedDashboardIds(
  screen: ScreenItem | null | undefined
): string[] {
  const ids = new Set<string>();
  for (const item of screen?.dashboards ?? []) {
    if (item) ids.add(String(item));
  }
  const collect = (panes: unknown) => {
    if (!Array.isArray(panes)) return;
    for (const pane of panes) {
      if (!pane || typeof pane !== "object") continue;
      const record = pane as { type?: string; dashboard?: unknown };
      if (record.type === "dashboard" && record.dashboard) {
        ids.add(String(record.dashboard));
      }
    }
  };
  collect(screen?.layout);
  collect(readFreeLayout(screen?.free_layout).panes);
  return [...ids];
}
