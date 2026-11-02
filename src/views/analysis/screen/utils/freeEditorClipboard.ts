import type { Ref } from "vue";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import type { PaneInserter } from "./freeInserter";
import { createFreeCloudClipboard } from "./freeCloudClipboard";
import { copySelection, pasteClipboard } from "./freeEditorActions";
import type { TranslateFn } from "./types";

export type FreeClipboardApi = ReturnType<typeof createFreeClipboard>;

/** 复制 / 粘贴 / 就地复制 / 云端剪贴板（插入链路统一走 PaneInserter） */
export function createFreeClipboard(deps: {
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
  design: Ref<FreeDesign>;
  inserter: PaneInserter;
  hasClipboard: Ref<boolean>;
  t: TranslateFn;
}) {
  /** 就地复制（含多选整组）：保持组内相对位置，整体层叠偏移 */
  const duplicate = (): number =>
    deps.selection.value.length === 0
      ? 0
      : deps.inserter.insert(
          deps.panes.value.filter(pane =>
            deps.selection.value.includes(pane.pk)
          )
        );

  const copy = (): number =>
    copySelection({
      panes: deps.panes,
      selection: deps.selection,
      design: deps.design,
      markHasClipboard: () => {
        deps.hasClipboard.value = true;
      },
      t: deps.t
    });

  const paste = (): number =>
    pasteClipboard(panesList => deps.inserter.insert(panesList));

  const { pasteFromCloud, clearCloud } = createFreeCloudClipboard({
    t: deps.t,
    insert: payload => deps.inserter.insert(payload)
  });

  return { duplicate, copy, paste, pasteFromCloud, clearCloud };
}
