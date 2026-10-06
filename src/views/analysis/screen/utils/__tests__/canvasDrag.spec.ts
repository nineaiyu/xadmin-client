import { mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { useCanvasDrag } from "../canvasDrag";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";

/**
 * 画布拖拽 / 缩放手势单测。
 *
 * 核心回归：撤销点在**实际位移超过阈值后**才记——按下未动的手势不产生
 * 空撤销点（否则点击窗格也会推进撤销栈，Undo 一步「无变化」）。
 */

const PANE: ScreenLayoutPane = {
  pk: "p1",
  type: "text",
  x: 0,
  y: 0,
  w: 3,
  h: 2
};

/** 栅格步长：横向 100px/格、纵向 52px/行（换算好算） */
const metrics = () => ({ stepX: 100, stepY: 52 });

const pointer = (x: number, y: number) =>
  new PointerEvent("pointerdown", { clientX: x, clientY: y });

const move = (x: number, y: number) =>
  window.dispatchEvent(
    new PointerEvent("pointermove", { clientX: x, clientY: y })
  );

const up = () => window.dispatchEvent(new PointerEvent("pointerup"));

function mountDrag(
  panes: Ref<ScreenLayoutPane[]>,
  pushHistory: (key?: string) => void
) {
  let api: { startTracking: ReturnType<typeof useCanvasDrag>["startTracking"] };
  const Host = defineComponent({
    setup() {
      api = useCanvasDrag({
        panes,
        selectedPk: ref(""),
        markDirty: vi.fn(),
        metrics,
        pushHistory
      });
      return () => h("div");
    }
  });
  const wrapper = mount(Host);
  return { wrapper, startTracking: api!.startTracking };
}

describe("useCanvasDrag 撤销点与位移", () => {
  let panes: Ref<ScreenLayoutPane[]>;
  let pushHistory: Mock<(key?: string) => void>;
  let wrapper: ReturnType<typeof mount> | undefined;

  afterEach(() => {
    // unmount 触发 composable 清理 window 指针监听，避免跨用例串扰
    wrapper?.unmount();
    wrapper = undefined;
  });

  const setup = () => {
    panes = ref<ScreenLayoutPane[]>([{ ...PANE }]);
    pushHistory = vi.fn();
    const mounted = mountDrag(panes, pushHistory);
    wrapper = mounted.wrapper;
    return mounted.startTracking;
  };

  it("按下未动（含微小抖动）不记撤销点", () => {
    const startTracking = setup();

    startTracking("move", "p1", pointer(400, 300));
    up();
    expect(pushHistory).not.toHaveBeenCalled();

    // 位移 ≤ 1px 阈值：视为抖动，既不记撤销点也不改布局
    startTracking("move", "p1", pointer(400, 300));
    move(400.5, 300);
    up();
    expect(pushHistory).not.toHaveBeenCalled();
    expect(panes.value[0].x).toBe(0);
  });

  it("实际位移超阈值后记一次撤销点，同一手势只记一个", () => {
    const startTracking = setup();

    startTracking("move", "p1", pointer(400, 300));
    move(520, 300); // 120px ≈ 1.2 格
    expect(pushHistory).toHaveBeenCalledTimes(1);
    expect(pushHistory).toHaveBeenCalledWith("drag-p1-move");
    expect(panes.value[0].x).toBe(1);

    move(640, 300); // 继续拖动：撤销点已记，不再重复
    expect(pushHistory).toHaveBeenCalledTimes(1);
    expect(panes.value[0].x).toBe(2);

    up();
  });

  it("缩放手势同样位移后才记，撤销点区分动作", () => {
    const startTracking = setup();

    startTracking("resize", "p1", pointer(400, 300));
    move(620, 300); // +220px ≈ 2 格
    expect(pushHistory).toHaveBeenCalledTimes(1);
    expect(pushHistory).toHaveBeenCalledWith("drag-p1-resize");
    expect(panes.value[0].w).toBe(5);

    up();
  });
});
