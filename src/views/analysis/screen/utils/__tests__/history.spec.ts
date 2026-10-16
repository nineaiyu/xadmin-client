import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { nudgeCoalesceKey, usePaneHistory } from "../history";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

/**
 * 方向键撤销点合并键单测。
 *
 * 核心回归：合并键只含窗格与动作语义段（移动/缩放），不含具体按键名——
 * 连续按不同方向键属于同一次布局微调，撤销应一步回到连按前。
 */

const PANE: ScreenLayoutPane = {
  pk: "p1",
  type: "text",
  x: 0,
  y: 0,
  w: 3,
  h: 2
};

function setup() {
  const panes = ref<ScreenLayoutPane[]>([{ ...PANE }]);
  const markDirty = vi.fn();
  const history = usePaneHistory({
    panes,
    selectedPk: ref("p1"),
    markDirty
  });
  return { panes, ...history };
}

describe("nudgeCoalesceKey 与方向键撤销点合并", () => {
  it("连按不同方向键（移动）并入同一撤销点，一步撤回到起点", () => {
    const { panes, pushHistory, canUndo, undo } = setup();

    // 模拟设计器：任意方向键的移动都生成同一合并键（ArrowUp → ArrowRight → ArrowDown）
    pushHistory(nudgeCoalesceKey("p1", false));
    panes.value = [{ ...panes.value[0], x: 1 }];
    pushHistory(nudgeCoalesceKey("p1", false));
    panes.value = [{ ...panes.value[0], x: 2 }];
    pushHistory(nudgeCoalesceKey("p1", false));
    panes.value = [{ ...panes.value[0], x: 3 }];

    expect(canUndo.value).toBe(true);
    undo();
    expect(panes.value[0].x).toBe(0);
    expect(canUndo.value).toBe(false);
  });

  it("移动与缩放是不同动作语义：各记独立撤销点", () => {
    const { panes, pushHistory, canUndo, undo } = setup();

    pushHistory(nudgeCoalesceKey("p1", false));
    panes.value = [{ ...panes.value[0], x: 1 }];
    pushHistory(nudgeCoalesceKey("p1", true));
    panes.value = [{ ...panes.value[0], w: 4 }];

    undo();
    expect(panes.value[0].w).toBe(3);
    expect(canUndo.value).toBe(true);
    undo();
    expect(panes.value[0].x).toBe(0);
  });
});
