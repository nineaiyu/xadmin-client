import { cloneDeep } from "@pureadmin/utils";
import type { Ref } from "vue";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";

type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/** 搜索表单默认值装配（fieldsCallback 与 内联首开共用），自带 route.query 覆盖 */
export function createFieldsInitCallback({
  searchFields,
  defaultValue,
  tablePagination,
  searchDefaultValue,
  routeParams
}: {
  searchFields: Ref<{ size?: number; page?: number; [key: string]: unknown }>;
  defaultValue: Ref<Record<string, unknown>>;
  tablePagination: Ref<NonNullable<RePlusPageProps["pagination"]>>;
  searchDefaultValue: BaseColumnsReturn["searchDefaultValue"];
  routeParams: Record<string, unknown>;
}) {
  return () => {
    defaultValue.value = {
      ...{
        page: tablePagination.value.currentPage,
        size: tablePagination.value.pageSize,
        ordering: "-created_time"
      },
      ...searchDefaultValue.value
    };
    searchFields.value = cloneDeep(defaultValue.value);

    if (routeParams) {
      const parameter = cloneDeep(routeParams);
      Object.keys(parameter).forEach(param => {
        searchFields.value[param] = parameter[param];
      });
    }
  };
}

/** 首开编排：内联元数据（with_meta=1）优先，缺元数据键时回退分离请求 */
export function createGetPageColumn({
  props,
  auth,
  handleGetData,
  fetchColumnsSeparately
}: {
  props: RePlusPageProps;
  auth: { list?: unknown };
  handleGetData: (
    queryParams?: object,
    options?: { inline?: boolean; onInlineMetaMissing?: () => void }
  ) => void;
  fetchColumnsSeparately: (immediate: boolean) => void;
}) {
  const { api } = props;
  return (immediate: boolean) => {
    if (immediate && auth.list && api.list) {
      // 首开以 with_meta=1 合并 list/search-columns/search-fields 三个请求；
      // 响应缺元数据键（旧后端/无元数据 Action）时回退分离请求
      handleGetData(
        { with_meta: 1 },
        {
          inline: true,
          onInlineMetaMissing: () => fetchColumnsSeparately(immediate)
        }
      );
      return;
    }
    fetchColumnsSeparately(immediate);
  };
}

/** 分离请求拉取列/字段元数据（与内联首开回退共用同一回调装配） */
export function createFetchColumnsSeparately({
  props,
  auth,
  getColumnData,
  columnsInitCallback,
  fieldsInitCallback,
  handleGetData
}: {
  props: RePlusPageProps;
  auth: { list?: unknown };
  getColumnData: BaseColumnsReturn["getColumnData"];
  columnsInitCallback: () => void;
  fieldsInitCallback: () => void;
  handleGetData: (queryParams?: object) => void;
}) {
  const { api } = props;
  return (immediate: boolean) => {
    // fetchSearchFields=false：页面声明不消费分离的 search-fields 端点，
    // 与「api 无 fields 方法」同一路径（跳过请求、数据装配退回列回调分支）
    const fieldsApi = props.fetchSearchFields === false ? null : api.fields;
    getColumnData(
      auth.list ? api.columns : null,
      fieldsApi,
      () => {
        columnsInitCallback();
        if (!fieldsApi && immediate) {
          handleGetData();
        }
      },
      () => {
        fieldsInitCallback();
        if (immediate) {
          handleGetData();
        }
      }
    );
  };
}
