import { beforeEach, describe, expect, it, vi } from "vitest";

const itemsMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/system/dict", () => ({
  dataDictApi: { items: itemsMock }
}));

import {
  clearDictCache,
  dictTagProps,
  getDictItem,
  getDictItems,
  statusTagProps,
  useDict
} from "./dict";

const ITEMS = [
  { value: "1", label: "男", color: "#409EFF" },
  { value: "2", label: "女" }
];

function itemsResponse(results: unknown) {
  return { code: 1000, data: { results } };
}

describe("getDictItems 缓存与并发去重", () => {
  beforeEach(() => {
    itemsMock.mockReset().mockResolvedValue(itemsResponse(ITEMS));
    clearDictCache();
  });

  it("成功结果进入进程内缓存，二次调用不再发请求", async () => {
    await getDictItems("user_gender");
    await getDictItems("user_gender");
    expect(itemsMock).toHaveBeenCalledTimes(1);
    expect(await getDictItems("user_gender")).toEqual(ITEMS);
  });

  it("TTL 过期后重新拉取", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      await getDictItems("user_gender");
      vi.setSystemTime(5 * 60 * 1000 + 1); // 越过 5 分钟 TTL
      await getDictItems("user_gender");
      expect(itemsMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("并发调用合并为一次请求（inflight 去重）", async () => {
    const [a, b] = await Promise.all([getDictItems("x"), getDictItems("x")]);
    expect(itemsMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(ITEMS);
    expect(b).toEqual(ITEMS);
  });

  it("失败降级为空数组且不缓存（下次可重试）", async () => {
    itemsMock.mockRejectedValueOnce(new Error("network"));
    expect(await getDictItems("x")).toEqual([]);
    expect(await getDictItems("x")).toEqual(ITEMS);
    expect(itemsMock).toHaveBeenCalledTimes(2);
  });

  it("clearDictCache 指定 code 清单条，缺省清全部", async () => {
    await getDictItems("a");
    await getDictItems("b");
    clearDictCache("a");
    await getDictItems("a");
    await getDictItems("b");
    expect(itemsMock).toHaveBeenCalledTimes(3);
    clearDictCache();
    await getDictItems("a");
    expect(itemsMock).toHaveBeenCalledTimes(4);
  });
});

describe("getDictItem 反查", () => {
  beforeEach(() => {
    itemsMock.mockReset().mockResolvedValue(itemsResponse(ITEMS));
    clearDictCache();
  });

  it("按 value 命中（数字入参字符串化对齐）", async () => {
    expect((await getDictItem("user_gender", "1"))?.label).toBe("男");
    expect((await getDictItem("user_gender", 2))?.label).toBe("女");
    expect(await getDictItem("user_gender", "9")).toBeUndefined();
    expect(await getDictItem("user_gender", null)).toBeUndefined();
  });
});

describe("useDict 组件用法", () => {
  beforeEach(() => {
    itemsMock.mockReset().mockResolvedValue(itemsResponse(ITEMS));
    clearDictCache();
  });

  it("拉取驱动 loading 状态，refresh 重新加载", async () => {
    // useDict 不挂生命周期钩子，可在组件外直接驱动
    const { items, loading, refresh } = useDict("user_gender");
    expect(loading.value).toBe(true);
    await vi.waitFor(() => expect(loading.value).toBe(false));
    expect(items.value).toEqual(ITEMS);

    itemsMock.mockResolvedValue(itemsResponse([ITEMS[0]]));
    clearDictCache();
    refresh();
    await vi.waitFor(() => expect(items.value).toHaveLength(1));
    expect(loading.value).toBe(false);
  });
});

describe("tag props 工具", () => {
  it("dictTagProps：无色返回 undefined，有色补白字去边框", () => {
    expect(dictTagProps(undefined)).toBeUndefined();
    expect(dictTagProps(null)).toBeUndefined();
    expect(dictTagProps("#f00")).toEqual({
      color: "#f00",
      style: { border: "none", color: "#fff" }
    });
  });

  it("statusTagProps：字典色优先", () => {
    expect(statusTagProps({ value: "1", label: "男", color: "#0f0" })).toEqual({
      color: "#0f0",
      style: { border: "none", color: "#fff" }
    });
  });

  it("statusTagProps：无色回退枚举映射，未知值落 info", () => {
    expect(statusTagProps({ value: "RUNNING" })).toEqual({ type: "primary" });
    expect(statusTagProps("SUCCESS")).toEqual({ type: "success" });
    expect(statusTagProps("whatever")).toEqual({ type: "info" });
    expect(statusTagProps(null)).toEqual({ type: "info" });

    const custom = { DONE: "success" } as const;
    expect(statusTagProps("DONE", custom)).toEqual({ type: "success" });
  });

  it("statusTagProps：对象无 color 时按 value 回退", () => {
    expect(statusTagProps({ value: "FAILURE", label: "失败" })).toEqual({
      type: "danger"
    });
  });
});
