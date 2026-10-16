import { ref } from "vue";
import type { RePlusPageProps } from "./types";

/**
 * 分页配置（自 usePlusPageState 抽出）：树形列表数据经 fetchAllRows 全量拉取，
 * 分页器仅展示总数；不再提供翻页/切页大小（切页会破坏树形父子结构的展示完整性）。
 */
export function createTablePagination(props: RePlusPageProps) {
  const defaultPagination: RePlusPageProps["pagination"] = {
    total: 0,
    pageSize: 15,
    currentPage: 1,
    pageSizes: [5, 10, 15, 30, 50, 100],
    background: true,
    size: "default"
  };
  if (props.isTree) {
    defaultPagination.pageSize = 1000;
    defaultPagination.layout = "total";
    defaultPagination.pageSizes = [];
  }
  return ref<NonNullable<RePlusPageProps["pagination"]>>({
    ...defaultPagination,
    ...props.pagination
  });
}
