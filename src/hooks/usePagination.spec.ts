import { nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";

import { paginate, usePagination } from "./usePagination";

describe("paginate", () => {
  it("按页码切片（1 基）", () => {
    expect(paginate([1, 2, 3, 4, 5], 1, 2)).toEqual([1, 2]);
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(paginate([1, 2, 3, 4, 5], 3, 2)).toEqual([5]);
  });

  it("页码 / 每页条数非法时抛错", () => {
    expect(() => paginate([1], 0, 2)).toThrow();
    expect(() => paginate([1], 1, 0)).toThrow();
  });
});

describe("usePagination", () => {
  it("总条数 / 总页数 / 当前页切片", () => {
    const list = ref([1, 2, 3, 4, 5]);
    const { total, totalPages, paginationList, currentPage, setCurrentPage } =
      usePagination(list, 2);
    expect(total.value).toBe(5);
    expect(totalPages.value).toBe(3);
    expect(paginationList.value).toEqual([1, 2]);
    setCurrentPage(2);
    expect(currentPage.value).toBe(2);
    expect(paginationList.value).toEqual([3, 4]);
  });

  it("越界页码抛错", () => {
    const list = ref([1, 2, 3]);
    const { setCurrentPage } = usePagination(list, 2);
    expect(() => setCurrentPage(9)).toThrow();
  });

  it("总条数变化回到第一页", async () => {
    const list = ref([1, 2, 3, 4]);
    const { currentPage, setCurrentPage, total } = usePagination(list, 2);
    setCurrentPage(2);
    expect(currentPage.value).toBe(2);

    list.value = [1, 2, 3, 4, 5, 6];
    await nextTick();
    expect(total.value).toBe(6);
    expect(currentPage.value).toBe(1);
  });

  it("setPageSize 重算总页数并回到第一页", () => {
    const list = ref([1, 2, 3, 4, 5]);
    const { totalPages, currentPage, setPageSize } = usePagination(list, 2);
    setPageSize(3);
    expect(totalPages.value).toBe(2);
    expect(currentPage.value).toBe(1);
    expect(() => setPageSize(0)).toThrow();
  });
});
