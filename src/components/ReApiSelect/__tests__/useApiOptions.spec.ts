import { describe, expect, it, vi } from "vitest";

import { useApiOptions } from "../src/useApiOptions";

describe("useApiOptions 远程选项取数与归一", () => {
  it("按 labelField / valueField 归一，未声明时回退 label / value", async () => {
    const api = vi.fn().mockResolvedValue([
      { name: "甲", id: 1 },
      { name: "乙", id: 2 }
    ]);
    const state = useApiOptions(() => ({
      api,
      labelField: "name",
      valueField: "id"
    }));
    await state.fetch();
    expect(state.options.value).toEqual([
      { name: "甲", id: 1, label: "甲", value: 1 },
      { name: "乙", id: 2, label: "乙", value: 2 }
    ]);
  });

  it("resultField 提取嵌套数组；childrenField 递归归一子节点", async () => {
    const api = vi.fn().mockResolvedValue({
      data: { items: [{ name: "父", id: 1, kids: [{ name: "子", id: 2 }] }] }
    });
    const state = useApiOptions(() => ({
      api,
      labelField: "name",
      valueField: "id",
      resultField: "items",
      childrenField: "kids"
    }));
    await state.fetch();
    const [parent] = state.options.value;
    expect(parent.label).toBe("父");
    expect(parent.children).toEqual([
      { name: "子", id: 2, label: "子", value: 2 }
    ]);
  });

  it("numberToString 把值转字符串；beforeFetch / afterFetch 生效", async () => {
    const api = vi.fn().mockResolvedValue([{ label: "A", value: 1 }]);
    const state = useApiOptions(() => ({
      api,
      numberToString: true,
      params: { a: 1 },
      beforeFetch: params => ({ ...params, b: 2 }),
      afterFetch: list =>
        list.map(item => ({
          ...(item as Record<string, unknown>),
          extra: true
        }))
    }));
    await state.fetch();
    expect(api).toHaveBeenCalledWith({ a: 1, b: 2 });
    expect(state.options.value[0]).toMatchObject({ value: "1", extra: true });
  });

  it("首次取数后缓存；alwaysLoad 时每次重取", async () => {
    const api = vi.fn().mockResolvedValue([{ label: "A", value: 1 }]);
    const cached = useApiOptions(() => ({ api }));
    await cached.fetch();
    await cached.fetch();
    expect(api).toHaveBeenCalledTimes(1);

    const always = useApiOptions(() => ({ api, alwaysLoad: true }));
    await always.fetch();
    await always.fetch();
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("updateParam 合并参数并强制重取；无 api 时 fetch 为空操作", async () => {
    const api = vi.fn().mockResolvedValue([]);
    const state = useApiOptions(() => ({ api, params: { a: 1 } }));
    await state.updateParam({ b: 2 });
    expect(api).toHaveBeenLastCalledWith({ a: 1, b: 2 });

    const noApi = useApiOptions(() => ({}));
    await expect(noApi.fetch()).resolves.toBeUndefined();
    expect(noApi.options.value).toEqual([]);
  });

  it("取数失败降级为空选项且不抛出（可选下拉失败不阻断表单）", async () => {
    const api = vi.fn().mockRejectedValue(new Error("boom"));
    const state = useApiOptions(() => ({ api }));
    await expect(state.fetch()).resolves.toBeUndefined();
    expect(state.options.value).toEqual([]);
    expect(state.loading.value).toBe(false);

    // 未置 loaded：下一次打开 / reload 仍会重试
    await state.fetch();
    expect(api).toHaveBeenCalledTimes(2);
  });
});
