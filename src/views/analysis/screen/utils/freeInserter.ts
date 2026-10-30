import { message } from "@/utils/message";
import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { FREE_MAX_PANES, type FreeDesign } from "./freeLayout";
import { insertPanes } from "./freeClipboard";
import type { InsertSummary, TranslateFn } from "./types";

/**
 * 自由画布的**插入链路**（粘贴 / 就地复制 / 应用模板共用一处）：
 * 过滤引用不可见的窗格（服务端保存时会拒，提前丢掉并计数）→ 新 pk → 层叠偏移 →
 * 夹回画幅 → 数量上限截断 → 写数据（整批一个撤销点）→ 选中新窗格 → 提示。
 *
 * 调用方只决定「插什么」与「替换还是追加」，几何与计数归一都在这里。
 */
export function createPaneInserter(deps: {
  t: TranslateFn;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  design: Ref<FreeDesign>;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
  pushHistory: (key?: string) => void;
  markDirty: () => void;
}) {
  /** 剩余可插入数量（自由画布数量上限 - 现有窗格） */
  const room = () => Math.max(FREE_MAX_PANES - deps.panes.value.length, 0);

  function report(summary: InsertSummary) {
    if (summary.skippedRefs > 0) {
      message(deps.t("dataScreen.insertSkipped", { n: summary.skippedRefs }), {
        type: "warning"
      });
    }
    if (summary.truncated > 0) {
      message(deps.t("dataScreen.insertTruncated", { n: summary.truncated }), {
        type: "warning"
      });
    }
  }

  /**
   * 插入一批窗格：默认追加，`replace` 为整屏替换（模板替换应用）。
   * 返回实际插入数量（0 = 没有可插入内容，已给提示）。
   *
   * - `limit` 缺省：追加按剩余容量截断；**替换按全量画幅容量**（替换语义是
   *   「用模板内容换掉现有窗格」，按剩余容量算会让满画布替换直接插 0）；
   * - `design` override：替换应用模板时按「目标画幅」夹取，成功后由调用方
   *   才落 `design`（先插入成功再改画幅，失败不动画幅）；撤销点在此处记录，
   *   快照同时含旧画幅与旧窗格，撤销时两者一起回退。
   */
  function insert(
    source: readonly ScreenLayoutPane[],
    options: { replace?: boolean; limit?: number; design?: FreeDesign } = {}
  ): number {
    const { panes: inserted, summary } = insertPanes({
      source,
      design: options.design ?? deps.design.value,
      dashboards: deps.dashboards.value,
      datasets: deps.datasets.value,
      limit: options.limit ?? (options.replace ? FREE_MAX_PANES : room())
    });
    if (inserted.length === 0) {
      message(deps.t("dataScreen.pasteNothing"), { type: "warning" });
      return 0;
    }
    deps.pushHistory();
    deps.panes.value = options.replace
      ? inserted
      : [...deps.panes.value, ...inserted];
    deps.selection.value = inserted.map(pane => pane.pk);
    report(summary);
    deps.markDirty();
    return inserted.length;
  }

  return { insert, room };
}

export type PaneInserter = ReturnType<typeof createPaneInserter>;
