import { cloneDeep } from "@pureadmin/utils";
import type { Ref } from "vue";
import type { RePlusPageProps } from "./types";

/**
 * 搜索区与分页事件（自 usePlusPageData.ts 抽出）：重置 / 查询 / 切页大小 /
 * 切页码，统一「先同步搜索字段再拉数据」的口径。
 */
export function createSearchEvents({
  searchFields,
  defaultValue,
  tablePagination,
  handleGetData
}: {
  searchFields: Ref<{ size?: number; page?: number; [key: string]: unknown }>;
  defaultValue: Ref<Record<string, unknown>>;
  tablePagination: Ref<NonNullable<RePlusPageProps["pagination"]>>;
  handleGetData: (queryParams?: object) => void;
}) {
  const initSearchFields = () => {
    searchFields.value = cloneDeep(defaultValue.value);
    tablePagination.value.pageSize = searchFields.value.size;
    tablePagination.value.currentPage = searchFields.value.page;
  };

  const handleReset = () => {
    initSearchFields();
    handleGetData();
  };

  const handleSearch = () => {
    searchFields.value.page = tablePagination.value.currentPage = 1;
    handleGetData();
  };

  const handleSizeChange = (val: number) => {
    searchFields.value.page = 1;
    searchFields.value.size = val;
    handleGetData();
  };

  const handleCurrentChange = (val: number) => {
    searchFields.value.page = val;
    handleGetData();
  };

  return {
    initSearchFields,
    handleReset,
    handleSearch,
    handleSizeChange,
    handleCurrentChange
  };
}
