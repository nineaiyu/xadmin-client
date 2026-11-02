import type { Ref } from "vue";
import type {
  ScreenFreeLayout,
  ScreenLayoutPane
} from "@/api/dataset/analysis";
import { buildFreeLayout, readFreeLayout, type FreeDesign } from "./freeLayout";

export type FreePayloadApi = ReturnType<typeof createFreePayloadApi>;

/** 载荷装载 / 组装（保存前可传入预检后的清单覆盖当前窗格） */
export function createFreePayloadApi(deps: {
  design: Ref<FreeDesign>;
  panes: Ref<ScreenLayoutPane[]>;
  selection: Ref<string[]>;
}) {
  function load(raw?: Partial<ScreenFreeLayout> | null) {
    const read = readFreeLayout(raw);
    deps.design.value = read.design;
    deps.panes.value = read.panes;
    deps.selection.value = [];
  }

  const toPayload = (override?: readonly ScreenLayoutPane[]) =>
    buildFreeLayout(override ?? deps.panes.value, deps.design.value);

  return { load, toPayload };
}
