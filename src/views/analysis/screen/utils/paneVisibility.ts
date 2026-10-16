import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";

/**
 * 窗格可见性过滤（栅格 / 自由两套载荷共用同一口径）。
 *
 * 窗格引用的仪表盘 / 数据集对浏览者不可见时整格跳过：服务端 `can_view_screen`
 * 与执行侧 fail-closed 才是权威（不可见引用在保存时即被拒绝），展示端只做
 * 展示层过滤，避免渲染出永远取不到数的空窗格。设计器不过滤——编辑者需要看到
 * 自己引用的全部窗格。
 */
export function visiblePanes(
  panes: readonly ScreenLayoutPane[],
  dashboards: readonly DashboardItem[],
  datasets: readonly DatasetItem[]
): ScreenLayoutPane[] {
  return panes.filter(
    pane =>
      (pane.type !== "dashboard" ||
        dashboards.some(item => item.pk === pane.dashboard)) &&
      (pane.type !== "metric" ||
        datasets.some(item => item.pk === pane.dataset))
  );
}
