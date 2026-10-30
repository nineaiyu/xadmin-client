import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { saveCloudClipboard } from "./serverTemplates";
import {
  createClipboard,
  readClipboard,
  writeClipboard
} from "./freeClipboard";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeLayerAction } from "./freePaneOps";
import type { TranslateFn } from "./types";

/**
 * 自由画布编辑器的层移动与本地剪贴板动作（自 createFreeEditor 抽出，行数门禁）。
 *
 * 层移动：单选走 freePaneOps；多选按选区整体置顶 / 置底 / 上移 / 下移一位。
 * 复制：本地剪贴板 + 云端双写（云端失败不阻断本地）；粘贴：插入链路。
 */

/** 多选整体层级移动：top/bottom 整组搬两端，up/down 逐位换位（保选区相对次序） */
export function moveSelectionLayer(
  deps: {
    panes: { value: ScreenLayoutPane[] };
    selection: { value: string[] };
    moveSingle: (pk: string, action: FreeLayerAction) => void;
    pushHistory: () => void;
  },
  action: FreeLayerAction
) {
  const pks = deps.selection.value;
  if (pks.length === 0) return;
  if (pks.length === 1) {
    deps.moveSingle(pks[0], action);
    return;
  }
  const list = [...deps.panes.value];
  const isChosen = (pane: ScreenLayoutPane) => pks.includes(pane.pk);
  const unchanged = (next: ScreenLayoutPane[]) =>
    next.every((pane, index) => pane.pk === list[index].pk);
  if (action === "top" || action === "bottom") {
    const chosen = list.filter(isChosen);
    const rest = list.filter(pane => !isChosen(pane));
    const next = action === "top" ? [...rest, ...chosen] : [...chosen, ...rest];
    if (unchanged(next)) return;
    deps.pushHistory();
    deps.panes.value = next;
    return;
  }
  const next = [...list];
  const dir = action === "up" ? 1 : -1;
  const order = action === "up" ? [...next.keys()].reverse() : [...next.keys()];
  for (const index of order) {
    if (!isChosen(next[index])) continue;
    const target = index + dir;
    if (target < 0 || target >= next.length) continue;
    if (isChosen(next[target])) continue;
    [next[index], next[target]] = [next[target], next[index]];
  }
  if (unchanged(next)) return;
  deps.pushHistory();
  deps.panes.value = next;
}

/** 复制选区到本地剪贴板并双写云端；返回复制的窗格数 */
export function copySelection(deps: {
  panes: { value: ScreenLayoutPane[] };
  selection: { value: string[] };
  design: { value: { design_w: number; design_h: number } };
  markHasClipboard: () => void;
  t: TranslateFn;
}): number {
  const payload = createClipboard(
    deps.panes.value,
    deps.selection.value,
    deps.design.value
  );
  if (!payload) return 0;
  if (!writeClipboard(payload)) {
    message(deps.t("dataScreen.clipboardBlocked"), { type: "warning" });
  }
  deps.markHasClipboard();
  // 双写云端：无 create 权限的角色直接跳过（避免每次复制都弹一次失败提示）；
  // 有权限时失败只警告不阻断——本地剪贴板仍然可用
  if (hasAuth("create:ScreenClipboard")) {
    void saveCloudClipboard({
      design_w: payload.design.design_w,
      design_h: payload.design.design_h,
      panes: payload.panes
    }).then(ok => {
      if (!ok) {
        message(deps.t("dataScreen.clipboardCloudFailed"), {
          type: "warning"
        });
      }
    });
  }
  message(deps.t("dataScreen.copyDone", { n: payload.panes.length }), {
    type: "success"
  });
  return payload.panes.length;
}

/** 从本地剪贴板粘贴（经插入链路生成新窗格）；返回插入数 */
export function pasteClipboard(insert: (panes: ScreenLayoutPane[]) => number) {
  const payload = readClipboard();
  if (!payload) return 0;
  return insert(payload.panes);
}
