import type { ComputedRef, Ref } from "vue";
import type { Box } from "@/components/ReResize";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { FreeDesign } from "./freeLayout";
import type { FreeGridSnap } from "./freeSnap";

/** 自由画布手势层向上抛的事件（与 FreeCanvasBoard 的对应 emits 同形） */
export type FreeBoardGestureEmit = {
  (e: "select", payload: { pk: string; additive: boolean }): void;
  (e: "selectMany", payload: { pks: string[]; additive: boolean }): void;
  (e: "groupMove", payload: { pk: string; boxes: Record<string, Box> }): void;
  (
    e: "boxStop",
    payload: { pk: string; box: Box; gesture: "move" | "resize" }
  ): void;
  (
    e: "drop",
    payload: { type: ScreenPaneType; dashboard?: string; box: Box }
  ): void;
};

/** 手势层各控制器共享的依赖（响应式只读快照 + 画布引用 + 上抛入口） */
export interface FreeBoardGestureDeps {
  panes: ComputedRef<ScreenLayoutPane[]>;
  selection: ComputedRef<string[]>;
  design: ComputedRef<FreeDesign>;
  editable: ComputedRef<boolean>;
  gridSnap: ComputedRef<FreeGridSnap | undefined>;
  zoom: ComputedRef<number>;
  canvasRef: Ref<HTMLElement | undefined>;
  emit: FreeBoardGestureEmit;
}
