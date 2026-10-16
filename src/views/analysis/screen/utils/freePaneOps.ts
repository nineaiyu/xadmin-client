import type { Ref } from "vue";
import { message } from "@/utils/message";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import { genPaneId, paneBody, type PaneBox } from "./layout";
import {
  FREE_MAX_PANES,
  FREE_PANE_DEFAULTS,
  cascadedBox,
  clampFreeBox,
  type FreeDesign
} from "./freeLayout";
import type { TranslateFn } from "./types";

/** 层级操作：数组顺序即层级（后者在上） */
export type FreeLayerAction = "top" | "bottom" | "up" | "down";

/**
 * 自由画布窗格的本地变更（新增 / 删除 / 属性更新 / 单选层级调整）。
 *
 * 与栅格版（`paneOps`）并列但语义不同：位置与尺寸**越界夹回画幅、重叠一律允许**
 * （自由画布的核心能力是层叠）；层级 = 数组顺序，置顶/置底/上移/下移即数组重排。
 *
 * 选中不归本模块：`select` / `current` 由组合层注入（二期支持多选，选中集合是
 * 组合层的真相；这里只读「当前单选目标」，多选时为空串 = 批量属性编辑不适用）。
 * 复制（就地 / 剪贴板）统一走插入链路（`freeClipboard.insertPanes`），不在此重复实现。
 */
export function createFreePaneOps({
  panes,
  design,
  select,
  current,
  pushHistory,
  t
}: {
  panes: Ref<ScreenLayoutPane[]>;
  design: Ref<FreeDesign>;
  /** 选中指定窗格 */
  select: (_pk: string) => void;
  /** 当前单选目标（多选时为空串） */
  current: () => string;
  pushHistory: (key?: string) => void;
  t: TranslateFn;
}) {
  function addPane(type: ScreenPaneType, dashboard?: string, at?: PaneBox) {
    if (panes.value.length >= FREE_MAX_PANES) {
      message(t("dataScreen.panesFull", { max: FREE_MAX_PANES }), {
        type: "warning"
      });
      return;
    }
    const size = FREE_PANE_DEFAULTS[type];
    // 指定落点（组件库拖放 drop）夹回画幅就地落点，否则层叠错开（连续点击不叠成一坨）
    const box = at
      ? clampFreeBox(at, design.value)
      : cascadedBox(panes.value.length, size, design.value);
    pushHistory();
    const source = {
      pk: genPaneId(),
      type,
      ...box,
      ...(type === "dashboard" ? { dashboard } : {})
    } as ScreenLayoutPane;
    const pane: ScreenLayoutPane = { ...paneBody(source), ...box };
    panes.value.push(pane);
    select(pane.pk);
  }

  function removePane(pk: string) {
    if (!panes.value.some(pane => pane.pk === pk)) return;
    pushHistory();
    panes.value = panes.value.filter(pane => pane.pk !== pk);
  }

  const BOX_KEYS = ["x", "y", "w", "h"] as const;

  function updatePane(patch: Partial<ScreenLayoutPane>) {
    const pk = current();
    const index = panes.value.findIndex(pane => pane.pk === pk);
    if (index < 0) return;
    const boxKey = BOX_KEYS.find(key => key in patch);
    const otherKey = Object.keys(patch).find(
      key => !BOX_KEYS.includes(key as (typeof BOX_KEYS)[number])
    );
    const merged = { ...panes.value[index], ...patch };
    // 位置/尺寸改动与手势同口径：夹回画幅（自由画布允许重叠，不做碰撞驳回）
    if (boxKey) {
      Object.assign(merged, clampFreeBox(merged, design.value));
    }
    pushHistory(
      boxKey
        ? `box-${pk}-${boxKey}`
        : otherKey
          ? `prop-${pk}-${otherKey}`
          : undefined
    );
    panes.value[index] = merged;
  }

  /** 层级调整（单选）：已在目标位次时不动 */
  function moveLayer(pk: string, action: FreeLayerAction) {
    const index = panes.value.findIndex(pane => pane.pk === pk);
    if (index < 0) return;
    const last = panes.value.length - 1;
    const target =
      action === "top"
        ? last
        : action === "bottom"
          ? 0
          : action === "up"
            ? Math.min(index + 1, last)
            : Math.max(index - 1, 0);
    if (target === index) return;
    pushHistory();
    const next = [...panes.value];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    panes.value = next;
  }

  return { addPane, removePane, updatePane, moveLayer };
}
