import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import {
  MAX_PANES,
  PANE_DEFAULTS,
  canPlace,
  clampBox,
  findSlot,
  genPaneId,
  type PaneBox
} from "./layout";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 窗格增删改的本地变更（新增 / 复制 / 删除 / 属性面板更新）。
 *
 * - 变更前先 `pushHistory` 记撤销点；
 * - 新增自动找首个空位，画布排满给可读提示；指定落点（组件库拖拽 drop）
 *   且可放则就地落格；
 * - 位置/尺寸改动与拖拽同口径：夹回栅格后仍重叠则驳回（避免保存时才被
 *   服务端 400 打回）。
 */
export function createPaneOps({
  panes,
  selectedPk,
  pushHistory,
  t
}: {
  panes: Ref<ScreenLayoutPane[]>;
  selectedPk: Ref<string>;
  pushHistory: (key?: string) => void;
  t: TFunction;
}) {
  function addPane(type: ScreenPaneType, dashboard?: string, at?: PaneBox) {
    if (panes.value.length >= MAX_PANES) {
      message(t("dataScreen.panesFull", { max: MAX_PANES }), {
        type: "warning"
      });
      return;
    }
    const size = PANE_DEFAULTS[type];
    // 指定落点（组件库拖拽 drop）且可放则就地落格，否则行优先找首个空位
    const slot =
      at && canPlace(panes.value, at)
        ? clampBox(at)
        : findSlot(panes.value, size.w, size.h);
    if (!slot) {
      message(t("dataScreen.canvasFull"), { type: "warning" });
      return;
    }
    pushHistory();
    const pane: ScreenLayoutPane = {
      pk: genPaneId(),
      type,
      ...slot,
      ...(type === "dashboard" ? { dashboard } : {}),
      ...(type === "text" ? { text: "", align: "left", size: 24 } : {}),
      ...(type === "clock" ? { size: 40 } : {}),
      ...(type === "metric" ? { metric: "count" } : {}),
      ...(type === "image" ? { url: "", fit: "cover" } : {})
    };
    panes.value.push(pane);
    selectedPk.value = pane.pk;
  }

  /** 复制选中窗格（新 pk + 找空位；同类型属性原样保留） */
  function duplicateSelected() {
    const source = panes.value.find(pane => pane.pk === selectedPk.value);
    if (!source) return;
    if (panes.value.length >= MAX_PANES) {
      message(t("dataScreen.panesFull", { max: MAX_PANES }), {
        type: "warning"
      });
      return;
    }
    // 先试右下相邻位（平铺复制的手感），不行再回落首个空位
    const near = clampBox({
      x: source.x + 1,
      y: source.y + 1,
      w: source.w,
      h: source.h
    });
    const slot = canPlace(panes.value, near)
      ? near
      : findSlot(panes.value, source.w, source.h);
    if (!slot) {
      message(t("dataScreen.canvasFull"), { type: "warning" });
      return;
    }
    pushHistory();
    const pane: ScreenLayoutPane = { ...source, ...slot, pk: genPaneId() };
    panes.value.push(pane);
    selectedPk.value = pane.pk;
  }

  function removePane(pk: string) {
    if (!panes.value.some(pane => pane.pk === pk)) return;
    pushHistory();
    panes.value = panes.value.filter(pane => pane.pk !== pk);
    if (selectedPk.value === pk) selectedPk.value = "";
  }

  const BOX_KEYS = ["x", "y", "w", "h"] as const;

  function updatePane(patch: Partial<ScreenLayoutPane>) {
    const index = panes.value.findIndex(pane => pane.pk === selectedPk.value);
    if (index < 0) return;
    const boxKey = BOX_KEYS.find(key => key in patch);
    const otherKey = Object.keys(patch).find(
      key => !BOX_KEYS.includes(key as (typeof BOX_KEYS)[number])
    );
    const merged = { ...panes.value[index], ...patch };
    // 位置/尺寸改动与拖拽同一口径：夹回栅格后仍重叠则驳回（避免保存时才被服务端 400 打回）
    if (boxKey) {
      const box = clampBox({
        x: merged.x,
        y: merged.y,
        w: merged.w,
        h: merged.h
      });
      if (!canPlace(panes.value, box, index)) {
        message(t("dataScreen.overlapRejected"), { type: "warning" });
        return;
      }
      Object.assign(merged, box);
    }
    pushHistory(
      boxKey
        ? `box-${selectedPk.value}-${boxKey}`
        : otherKey
          ? `prop-${selectedPk.value}-${otherKey}`
          : undefined
    );
    panes.value[index] = merged;
  }

  return { addPane, duplicateSelected, removePane, updatePane };
}
