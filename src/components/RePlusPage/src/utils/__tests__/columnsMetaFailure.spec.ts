import { describe, expect, it, vi } from "vitest";

// 列装配会读 i18n（label 兜底）：只覆盖 useI18n，保留 createI18n 供 plugins/i18n 初始化
vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

import { useBaseColumns } from "../columns";

/**
 * 列元数据请求失败时的兜底。
 *
 * 契约：search-columns / search-fields 失败都不阻断列表——
 * 1) 对应回调仍执行（页面结束 loading、进入可重试态）；
 * 2) 列保持空数组（不抛错、不留半初始化数据）；
 * 3) 不向调用方重抛（避免 unhandled rejection）。
 */
describe("列元数据请求失败", () => {
  it("search-columns 失败：回调仍执行且列保持空", async () => {
    const { getColumnData } = useBaseColumns("zh-CN");
    const columnsCallback = vi.fn();
    const apiColumns = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      getColumnData(apiColumns, null, columnsCallback)
    ).resolves.toBeUndefined();

    expect(apiColumns).toHaveBeenCalledTimes(1);
    expect(columnsCallback).toHaveBeenCalledTimes(1);
    const payload = columnsCallback.mock.calls[0][0];
    expect(payload.listColumns.value).toEqual([]);
    expect(payload.addOrEditColumns.value).toEqual([]);
    expect(payload.detailColumns.value).toEqual([]);
    expect(payload.addOrEditDefaultValue.value).toEqual({});
  });

  it("search-fields 失败：搜索区保持空但回调仍执行", async () => {
    const { getColumnData } = useBaseColumns("zh-CN");
    const fieldsCallback = vi.fn();
    const apiFields = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      getColumnData(null, apiFields, null, fieldsCallback)
    ).resolves.toBeUndefined();

    expect(fieldsCallback).toHaveBeenCalledTimes(1);
    expect(fieldsCallback.mock.calls[0][0].searchColumns.value).toEqual([]);
  });

  it("search-columns 成功：列装配完成后回调一次", async () => {
    const { getColumnData } = useBaseColumns("zh-CN");
    const columnsCallback = vi.fn();
    const apiColumns = vi.fn().mockResolvedValue({
      data: [{ key: "name", label: "名称", input_type: "input", table_show: 1 }]
    });

    await getColumnData(apiColumns, null, columnsCallback);

    expect(columnsCallback).toHaveBeenCalledTimes(1);
    const payload = columnsCallback.mock.calls[0][0];
    expect(
      (payload.listColumns.value as { prop: string }[]).map(item => item.prop)
    ).toContain("name");
  });
});
