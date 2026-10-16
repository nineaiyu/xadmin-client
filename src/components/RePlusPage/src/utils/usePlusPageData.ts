import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import { createPageRequest } from "./plusPageRequest";
import {
  createFetchColumnsSeparately,
  createFieldsInitCallback,
  createGetPageColumn
} from "./plusPageMetadata";
import { createSearchEvents } from "./plusPageSearchEvents";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/**
 * 请求与分页：搜索字段装配、请求序号防过期、分页/搜索事件与首开元数据编排。
 * 参数装配纯函数见 listParams.ts，请求编排见 plusPageRequest.ts，
 * 元数据装配与首开回退见 plusPageMetadata.ts，搜索区事件见 plusPageSearchEvents.ts。
 */
export function usePlusPageData({
  props,
  emit,
  t,
  routeParams,
  dataList,
  loadingStatus,
  searchFields,
  defaultValue,
  tablePagination,
  getColumnData,
  searchDefaultValue,
  columnsInitCallback
}: {
  props: RePlusPageProps;
  emit: (event: string, ...args: unknown[]) => void;
  t: TFunction;
  routeParams: Record<string, unknown>;
  dataList: Ref<unknown[]>;
  loadingStatus: Ref<boolean>;
  searchFields: Ref<{
    size?: number;
    page?: number;
    [key: string]: unknown;
  }>;
  defaultValue: Ref<Record<string, unknown>>;
  tablePagination: Ref<NonNullable<RePlusPageProps["pagination"]>>;
  getColumnData: BaseColumnsReturn["getColumnData"];
  searchDefaultValue: BaseColumnsReturn["searchDefaultValue"];
  columnsInitCallback: () => void;
}) {
  const { auth } = props;

  const fieldsInitCallback = createFieldsInitCallback({
    searchFields,
    defaultValue,
    tablePagination,
    searchDefaultValue,
    routeParams
  });

  // 数据获取
  const handleGetData = createPageRequest({
    props,
    t,
    emit,
    routeParams,
    dataList,
    loadingStatus,
    searchFields,
    tablePagination,
    getColumnData,
    columnsInitCallback,
    fieldsInitCallback
  });

  const fetchColumnsSeparately = createFetchColumnsSeparately({
    props,
    auth,
    getColumnData,
    columnsInitCallback,
    fieldsInitCallback,
    handleGetData
  });

  const getPageColumn = createGetPageColumn({
    props,
    auth,
    handleGetData,
    fetchColumnsSeparately
  });

  const { handleReset, handleSearch, handleSizeChange, handleCurrentChange } =
    createSearchEvents({
      searchFields,
      defaultValue,
      tablePagination,
      handleGetData
    });

  return {
    handleReset,
    handleSearch,
    handleSizeChange,
    handleCurrentChange,
    handleGetData,
    getPageColumn
  };
}
