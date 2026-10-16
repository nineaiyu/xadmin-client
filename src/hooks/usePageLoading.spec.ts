import { describe, expect, it, vi } from "vitest";
import { usePageLoading } from "./usePageLoading";

describe("usePageLoading", () => {
  it("默认初始为 false，可指定初始值（挂载即拉数的页面）", () => {
    expect(usePageLoading().loading.value).toBe(false);
    expect(usePageLoading(true).loading.value).toBe(true);
  });

  it("动作期间置 true，结束后（含正常返回）关闭", async () => {
    const { loading, runWithLoading } = usePageLoading();
    const states: boolean[] = [];
    const result = await runWithLoading(async () => {
      states.push(loading.value);
      return 42;
    });
    states.push(loading.value);
    expect(states).toEqual([true, false]);
    expect(result).toBe(42);
  });

  it("task 抛错：loading 仍然关闭，异常原样上抛（提示归 http 层）", async () => {
    const { loading, runWithLoading } = usePageLoading();
    const boom = new Error("network");
    await expect(
      runWithLoading(async () => {
        throw boom;
      })
    ).rejects.toThrow(boom);
    expect(loading.value).toBe(false);
  });

  it("就地降级型调用：task 内自行 try/catch 不影响 loading 关闭", async () => {
    const { loading, runWithLoading } = usePageLoading();
    await runWithLoading(async () => {
      try {
        throw new Error("fallback");
      } catch {
        // 就地兜底，不外抛
      }
    });
    expect(loading.value).toBe(false);
  });

  it("连续复用：每次动作独立开关", async () => {
    const { loading, runWithLoading } = usePageLoading();
    const task = vi.fn(async () => undefined);
    await runWithLoading(task);
    expect(loading.value).toBe(false);
    await runWithLoading(task);
    expect(loading.value).toBe(false);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
