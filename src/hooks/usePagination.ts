import type { Ref } from "vue";

import { computed, ref, unref, watch } from "vue";

/** 按页码切片（1 基）。页码 / 每页条数非法时抛错，使调用方的状态错误尽早暴露。 */
export function paginate<T>(list: T[], pageNo: number, pageSize: number): T[] {
  if (pageNo < 1) throw new Error("Page number must be positive");
  if (pageSize < 1) throw new Error("Page size must be positive");

  const offset = (pageNo - 1) * pageSize;
  return offset + pageSize >= list.length
    ? list.slice(offset)
    : list.slice(offset, offset + pageSize);
}

/**
 * 前端分页（对齐 vben `usePagination`）：总条数变化时回到第一页，避免停在越界页。
 */
export function usePagination<T = unknown>(
  list: Ref<T[]>,
  pageSize: number,
  totalChangeToFirstPage = true
) {
  const currentPage = ref(1);
  const pageSizeRef = ref(pageSize);

  const total = computed(() => unref(list).length);
  const totalPages = computed(() =>
    Math.ceil(total.value / unref(pageSizeRef))
  );
  const paginationList = computed(() =>
    paginate(unref(list), unref(currentPage), unref(pageSizeRef))
  );

  function setCurrentPage(page: number) {
    if (page === 1 && unref(totalPages) === 0) {
      currentPage.value = 1;
      return;
    }
    if (page < 1 || page > unref(totalPages)) {
      throw new Error("Invalid page number");
    }
    currentPage.value = page;
  }

  function setPageSize(size: number) {
    if (size < 1) throw new Error("Page size must be positive");
    pageSizeRef.value = size;
    currentPage.value = 1;
  }

  if (totalChangeToFirstPage) {
    watch(total, () => setCurrentPage(1));
  }

  return {
    currentPage,
    paginationList,
    total,
    totalPages,
    setCurrentPage,
    setPageSize
  };
}
