import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { parseOrdering, useTableSort } from "../src/utils/useTableSort";

describe("parseOrdering（ordering -> 表头排序状态）", () => {
  it("升序 / 降序前缀解析", () => {
    expect(parseOrdering("created_time")).toEqual({
      prop: "created_time",
      order: "ascending"
    });
    expect(parseOrdering("-created_time")).toEqual({
      prop: "created_time",
      order: "descending"
    });
  });

  it("复合排序取首个字段（表头标记无法表达多列排序）", () => {
    expect(parseOrdering("sort,-created_time")).toEqual({
      prop: "sort",
      order: "ascending"
    });
  });

  it("空值 / 纯前缀 / 首段为空安全返回 null", () => {
    expect(parseOrdering("")).toBeNull();
    expect(parseOrdering(null)).toBeNull();
    expect(parseOrdering(undefined)).toBeNull();
    expect(parseOrdering("-")).toBeNull();
    expect(parseOrdering(" , -a")).toBeNull();
  });
});

const setup = () => {
  const searchFields = ref<Record<string, unknown>>({
    page: 3,
    ordering: "-created_time"
  });
  const defaultValue = ref<Record<string, unknown>>({
    ordering: "-created_time"
  });
  const sort = vi.fn();
  const clearSort = vi.fn();
  const tableRef = ref({ getTableRef: () => ({ sort, clearSort }) });
  const handleGetData = vi.fn();
  const scope = effectScope();
  const api = scope.run(() =>
    useTableSort({ searchFields, defaultValue, tableRef, handleGetData })
  )!;
  return { api, searchFields, handleGetData, sort, clearSort, scope };
};

describe("useTableSort（表头排序与请求联动）", () => {
  it("点击升序：写入字段名并回到第一页刷新", () => {
    const { api, searchFields, handleGetData, scope } = setup();
    api.handleSortChange({ prop: "date_joined", order: "ascending" });
    expect(searchFields.value.ordering).toBe("date_joined");
    expect(searchFields.value.page).toBe(1);
    expect(handleGetData).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("点击降序：写入 - 前缀；取消排序回落页面默认值", () => {
    const { api, searchFields, scope } = setup();
    api.handleSortChange({ prop: "date_joined", order: "descending" });
    expect(searchFields.value.ordering).toBe("-date_joined");
    api.handleSortChange({ prop: "date_joined", order: null });
    expect(searchFields.value.ordering).toBe("-created_time");
    scope.stop();
  });

  it("缺 prop（非列排序事件）不触发请求", () => {
    const { api, handleGetData, scope } = setup();
    api.handleSortChange({ prop: null, order: "ascending" });
    expect(handleGetData).not.toHaveBeenCalled();
    scope.stop();
  });

  it("初始化赋值不回显（页面加载零视觉变化），后续变化同步表头标记", async () => {
    const { searchFields, sort, clearSort, scope } = setup();
    // 首次触发 = 元数据初始化写入 ordering：不回显
    searchFields.value.ordering = "-date_joined";
    await nextTick();
    expect(sort).not.toHaveBeenCalled();
    expect(clearSort).not.toHaveBeenCalled();

    // 外部（搜索区下拉 / 我的视图）再次改 ordering：回显排序标记
    searchFields.value.ordering = "-last_login";
    await nextTick();
    expect(sort).toHaveBeenCalledWith("last_login", "descending");

    // 清空排序：清除表头标记
    searchFields.value.ordering = "";
    await nextTick();
    expect(clearSort).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
