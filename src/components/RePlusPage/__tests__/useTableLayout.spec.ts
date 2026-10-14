import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  LAYOUT_HOLD_FRAMES,
  useTableLayout
} from "../src/utils/useTableLayout";

/**
 * 手动驱动的 rAF：jsdom 的帧时序不确定，而「隐藏多少帧」是 CLS 修复的核心语义
 * （少一帧列宽回弹就会在可见状态下被绘制），必须逐帧精确断言。
 */
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

beforeEach(() => {
  rafCallbacks = new Map();
  rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    rafId += 1;
    rafCallbacks.set(rafId, callback);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 推进一帧（执行当前队列并等待 Vue 副作用刷新） */
const runFrame = async () => {
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  pending.forEach(([, callback]) => callback(0));
  await nextTick();
};

const setup = () => {
  const tableElWidth = ref(1200);
  const columns = ref<Array<Record<string, unknown>>>([
    { prop: "username", width: 120 },
    { _column: { key: "operation" }, width: 260 }
  ]);
  const listColumnsLength = ref(2);
  /** 操作列内容实测宽度（0 = 未测到） */
  const contentWidth = ref(0);
  const scope = effectScope();
  const api = scope.run(() =>
    useTableLayout({
      tableElWidth,
      dynamicColumns: columns,
      listColumnsLength,
      operationConfiguredWidth: () => 260,
      operationContentWidth: () => contentWidth.value
    })
  )!;
  return {
    api,
    columns,
    tableElWidth,
    listColumnsLength,
    contentWidth,
    scope
  };
};

const operationWidth = (columns: { value: Array<Record<string, unknown>> }) =>
  (
    columns.value.find(
      column =>
        (column._column as { key?: string } | undefined)?.key === "operation"
    ) as { width?: number } | undefined
  )?.width;

describe("useTableLayout（列首帧隐藏窗口）", () => {
  it(`列集合变化立即隐藏，并在第 ${LAYOUT_HOLD_FRAMES} 帧后恢复显示`, async () => {
    const { api, columns, scope } = setup();
    expect(api.tableLayoutPending.value).toBe(false);

    columns.value = [...columns.value, { prop: "nickname", width: 100 }];
    await nextTick();
    expect(api.tableLayoutPending.value).toBe(true);

    for (let frame = 1; frame < LAYOUT_HOLD_FRAMES; frame += 1) {
      await runFrame();
      expect(api.tableLayoutPending.value).toBe(true);
    }

    await runFrame();
    expect(api.tableLayoutPending.value).toBe(false);
    scope.stop();
  });

  it("隐藏窗口内再次变化会从头计数（不提前显示）", async () => {
    const { api, columns, listColumnsLength, scope } = setup();

    columns.value = [...columns.value, { prop: "nickname", width: 100 }];
    await nextTick();
    await runFrame();

    // 列就地 push（元数据装配路径）：重新计时，旧窗口的剩余帧不再生效
    listColumnsLength.value += 1;
    await nextTick();
    expect(api.tableLayoutPending.value).toBe(true);

    for (let frame = 1; frame < LAYOUT_HOLD_FRAMES; frame += 1) {
      await runFrame();
    }
    expect(api.tableLayoutPending.value).toBe(true);

    await runFrame();
    expect(api.tableLayoutPending.value).toBe(false);
    scope.stop();
  });

  it("无横向滚动时操作列保持页面配置宽度", async () => {
    const { api, columns, scope } = setup();
    await nextTick();

    expect(operationWidth(columns)).toBe(260);
    expect(api.alignedOperationWidth.value).toBe(260);
    scope.stop();
  });

  it("内容实测宽度到达后就地收敛操作列宽度（按钮随权限显隐）", async () => {
    const { api, columns, contentWidth, scope } = setup();
    await nextTick();
    expect(operationWidth(columns)).toBe(260);

    // 数据渲染后实测：只剩一个按钮（含内边距 90px），列宽随之收敛
    contentWidth.value = 90;
    await nextTick();
    expect(api.alignedOperationWidth.value).toBe(90);
    expect(operationWidth(columns)).toBe(90);
    scope.stop();
  });

  it("内容宽度超过配置宽度时不反向撑宽（所见即配置）", async () => {
    const { api, tableElWidth, contentWidth, scope } = setup();
    await nextTick();

    // 容器变窄触发横向滚动 + 内容（300）比配置（260）宽：
    // 下限取配置宽度，结果与既有「按配置渲染」一致，不反向撑宽
    tableElWidth.value = 300;
    contentWidth.value = 300;
    await nextTick();
    expect(api.alignedOperationWidth.value).toBe(260);
    scope.stop();
  });
});
