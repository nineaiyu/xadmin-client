import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  MEASURE_RETRY_FRAMES,
  useOperationContentWidth
} from "../src/utils/useOperationContentWidth";

/** 实测实现被替换为受控桩：验证「rAF + 有限重试」的时序语义（真实测量见 operationContentWidth.spec） */
const measureMock = vi.fn<() => number>();
vi.mock("../src/utils/operationContentWidth", () => ({
  measureOperationContentWidth: () => measureMock()
}));

/** 手动驱动的 rAF：jsdom 帧时序不确定，而「重试多少帧」是本 hook 的核心语义 */
let rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

beforeEach(() => {
  measureMock.mockReset();
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

const runFrame = async () => {
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  pending.forEach(([, callback]) => callback(0));
  await nextTick();
};

const setup = () => {
  const rootRef = ref<HTMLElement | undefined>(document.createElement("div"));
  const dataList = ref<unknown[]>([]);
  const loading = ref(false);
  const scope = effectScope();
  const api = scope.run(() =>
    useOperationContentWidth(rootRef, dataList, loading)
  )!;
  return { api, dataList, loading, scope };
};

describe("useOperationContentWidth（数据渲染后 rAF 实测 + 有限重试）", () => {
  it("数据到达后下一帧实测并写回宽度", async () => {
    const { api, dataList, scope } = setup();
    measureMock.mockReturnValue(90);

    dataList.value = [{ pk: 1 }];
    await nextTick();
    expect(measureMock).not.toHaveBeenCalled(); // post-flush 不测：此时表格只有骨架

    await runFrame();
    expect(measureMock).toHaveBeenCalledTimes(1);
    expect(api.operationContentWidth.value).toBe(90);
    scope.stop();
  });

  it("单元格尚未渲染（实测为 0）时逐帧重试，量到即停", async () => {
    const { api, dataList, scope } = setup();
    measureMock
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(120);

    dataList.value = [{ pk: 1 }];
    await nextTick();

    await runFrame();
    expect(api.operationContentWidth.value).toBe(0);
    await runFrame();
    expect(api.operationContentWidth.value).toBe(0);
    await runFrame();
    expect(api.operationContentWidth.value).toBe(120);
    expect(measureMock).toHaveBeenCalledTimes(3);

    // 已量到：后续帧不再重试
    await runFrame();
    expect(measureMock).toHaveBeenCalledTimes(3);
    scope.stop();
  });

  it("始终量不到时最多重试 MEASURE_RETRY_FRAMES 帧（按配置宽度渲染）", async () => {
    const { api, dataList, scope } = setup();
    measureMock.mockReturnValue(0);

    dataList.value = [{ pk: 1 }];
    await nextTick();

    for (let frame = 0; frame < MEASURE_RETRY_FRAMES + 3; frame += 1) {
      await runFrame();
    }
    expect(measureMock).toHaveBeenCalledTimes(MEASURE_RETRY_FRAMES);
    expect(api.operationContentWidth.value).toBe(0);
    scope.stop();
  });

  it("loading 期间不测（等数据渲染完成）", async () => {
    const { dataList, loading, scope } = setup();
    measureMock.mockReturnValue(90);

    loading.value = true;
    dataList.value = [{ pk: 1 }];
    await nextTick();
    await runFrame();
    expect(measureMock).not.toHaveBeenCalled();

    loading.value = false;
    await nextTick();
    await runFrame();
    expect(measureMock).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("列集合晚于数据到达时，列就绪后补测（首屏宽度不停回配置值）", async () => {
    const rootRef = ref<HTMLElement | undefined>(document.createElement("div"));
    const dataList = ref<unknown[]>([]);
    const loading = ref(false);
    const columnsLength = ref(0);
    const scope = effectScope();
    const api = scope.run(() =>
      useOperationContentWidth(rootRef, dataList, loading, columnsLength)
    )!;

    // 数据先到、列还没注册：重试窗口耗尽，宽度保持未测到
    measureMock.mockReturnValue(0);
    dataList.value = [{ pk: 1 }];
    await nextTick();
    for (let frame = 0; frame < MEASURE_RETRY_FRAMES; frame += 1) {
      await runFrame();
    }
    expect(measureMock).toHaveBeenCalledTimes(MEASURE_RETRY_FRAMES);
    expect(api.operationContentWidth.value).toBe(0);

    // 列元数据到达（列数变化）：补测一次并写回
    measureMock.mockReturnValue(90);
    columnsLength.value = 12;
    await nextTick();
    await runFrame();
    expect(api.operationContentWidth.value).toBe(90);
    scope.stop();
  });
});
