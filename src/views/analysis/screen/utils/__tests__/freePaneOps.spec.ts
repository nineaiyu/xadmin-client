import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { message } from "@/utils/message";
import { createFreePaneOps } from "../freePaneOps";
import { FREE_MAX_PANES } from "../freeLayout";
import type { TranslateFn } from "../types";

/** 译文函数直接返回 key（断言里按 key 比对，与文案解耦） */
const t: TranslateFn = key => key;

const DESIGN = ref({ design_w: 1920, design_h: 1080 });

const pane = (
  pk: string,
  box: { x: number; y: number; w: number; h: number },
  type: ScreenLayoutPane["type"] = "clock"
): ScreenLayoutPane => ({ pk, type, ...box });

/** 选中态由组合层持有：测试里用局部变量模拟 select / current */
function setup(initial: ScreenLayoutPane[] = [], selected = "") {
  const panes = ref<ScreenLayoutPane[]>(initial);
  const selectedPk = ref(selected);
  const pushHistory = vi.fn();
  const ops = createFreePaneOps({
    panes,
    design: DESIGN,
    select: pk => {
      selectedPk.value = pk;
    },
    current: () => selectedPk.value,
    pushHistory,
    t
  });
  return { panes, selectedPk, pushHistory, ...ops };
}

describe("自由画布窗格变更", () => {
  beforeEach(() => {
    vi.mocked(message).mockClear();
  });

  it("addPane：层叠错开落点、补齐类型默认值并选中新窗格", () => {
    const { panes, selectedPk, pushHistory, addPane } = setup();
    addPane("text");
    expect(pushHistory).toHaveBeenCalledTimes(1);
    expect(panes.value).toHaveLength(1);
    expect(panes.value[0]).toMatchObject({
      type: "text",
      x: 80,
      y: 80,
      w: 600,
      h: 80,
      text: "",
      align: "left",
      size: 24
    });
    expect(selectedPk.value).toBe(panes.value[0].pk);

    addPane("metric");
    expect(panes.value[1]).toMatchObject({
      type: "metric",
      x: 104,
      y: 104,
      metric: "count"
    });
  });

  it("addPane：指定落点越界夹回画幅（拖放不产生被拒载荷）", () => {
    const { panes, addPane } = setup();
    addPane("clock", undefined, { x: 1900, y: 1000, w: 240, h: 120 });
    expect(panes.value[0]).toMatchObject({ x: 1680, y: 960, w: 240, h: 120 });
  });

  it("addPane：到达数量上限时提示且不新增", () => {
    const full = Array.from({ length: FREE_MAX_PANES }, (_, index) =>
      pane(`p${index}`, { x: index, y: index, w: 16, h: 16 })
    );
    const { panes, addPane } = setup(full);
    addPane("clock");
    expect(panes.value).toHaveLength(FREE_MAX_PANES);
    expect(message).toHaveBeenCalledTimes(1);
  });

  it("removePane：删除窗格（选中清理由组合层负责）", () => {
    const { panes, removePane } = setup([
      pane("p1", { x: 0, y: 0, w: 240, h: 120 })
    ]);
    removePane("p1");
    expect(panes.value).toEqual([]);
  });

  it("updatePane：坐标夹回画幅且允许重叠（不做碰撞驳回）", () => {
    const { panes, selectedPk, updatePane } = setup(
      [
        pane("p1", { x: 0, y: 0, w: 400, h: 300 }),
        pane("p2", { x: 50, y: 50, w: 400, h: 300 })
      ],
      "p2"
    );
    updatePane({ x: 100, y: 100 });
    // 与 p1 完全重叠：自由画布允许（层级 = 数组顺序），只做画幅夹回
    expect(panes.value[1]).toMatchObject({ x: 100, y: 100 });
    updatePane({ x: 9999, y: 9999 });
    expect(panes.value[1]).toMatchObject({ x: 1520, y: 780 });
    updatePane({ x: 10, y: 10, w: 4, h: 4 });
    expect(panes.value[1]).toMatchObject({ x: 10, y: 10, w: 16, h: 16 });
    expect(selectedPk.value).toBe("p2");
  });

  it("moveLayer：数组顺序即层级，置顶/置底/上移/下移即重排", () => {
    const { panes, moveLayer } = setup([
      pane("p1", { x: 0, y: 0, w: 16, h: 16 }),
      pane("p2", { x: 0, y: 0, w: 16, h: 16 }),
      pane("p3", { x: 0, y: 0, w: 16, h: 16 })
    ]);
    const order = () => panes.value.map(item => item.pk);

    moveLayer("p1", "top");
    expect(order()).toEqual(["p2", "p3", "p1"]);
    moveLayer("p1", "down");
    expect(order()).toEqual(["p2", "p1", "p3"]);
    moveLayer("p1", "bottom");
    expect(order()).toEqual(["p1", "p2", "p3"]);
    moveLayer("p1", "up");
    expect(order()).toEqual(["p2", "p1", "p3"]);
  });

  it("moveLayer：已在目标位次时不产生变更（不记撤销点）", () => {
    const { panes, pushHistory, moveLayer } = setup([
      pane("p1", { x: 0, y: 0, w: 16, h: 16 }),
      pane("p2", { x: 0, y: 0, w: 16, h: 16 }),
      pane("p3", { x: 0, y: 0, w: 16, h: 16 })
    ]);
    moveLayer("p1", "top");
    expect(pushHistory).toHaveBeenCalledTimes(1);
    expect(panes.value.map(item => item.pk)).toEqual(["p2", "p3", "p1"]);
    moveLayer("p1", "top");
    expect(pushHistory).toHaveBeenCalledTimes(1);
  });
});
