import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { handleTree } from "@/utils/tree";
import { buildListParams, splitDateRangeFields } from "./listParams";
import type { Ref } from "vue";
import type { RePlusPageProps } from "./types";
import type { useI18n } from "vue-i18n";
import type { useBaseColumns } from "./columns";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/**
 * 列表请求编排（自 usePlusPageData.ts 抽出）：搜索字段装配、请求序号防过期、
 * 树形全量拉取与首开内联元数据消费（with_meta=1）。
 */
export function createPageRequest({
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
  tablePagination: Ref<NonNullable<RePlusPageProps["pagination"]>>;
  getColumnData: BaseColumnsReturn["getColumnData"];
  columnsInitCallback: () => void;
  fieldsInitCallback: () => void;
}) {
  const { api, isTree, beforeSearchSubmit, searchResultFormat } = props;

  // 请求序号：仅接受最新一次请求的响应，避免同页快速切换筛选/分页时旧响应覆盖新列表
  let latestRequestSeq = 0;

  return (
    queryParams = {},
    options: {
      /** 首开内联元数据消费（with_meta=1 响应中的 search_columns/search_fields） */
      inline?: boolean;
      /** 内联响应缺元数据键时的一次性回退（旧后端/无元数据 Action 视图集） */
      onInlineMetaMissing?: () => void;
    } = {}
  ) => {
    // 列表接口是分页数据源的必要条件（缺省时直接收尾 loading，不发起请求）
    if (!api.list) {
      loadingStatus.value = false;
      return;
    }
    const requestSeq = ++latestRequestSeq;
    loadingStatus.value = true;

    // 日期区间字段拆分为 _after/_before（就地写入搜索字段，区间选择器回显共用）
    splitDateRangeFields(searchFields.value);

    const params = buildListParams(searchFields.value, queryParams);
    const data = (beforeSearchSubmit && beforeSearchSubmit(params)) || params;

    // 树形列表（菜单/部门等）父子关系不能被分页切断，需全量数据；
    // fetchAllRows 按页循环拉满 total，返回形状与单页响应一致，消费逻辑无需区分
    const request = isTree ? fetchAllRows(api.list, data) : api.list(data);

    request
      .then(res => {
        // 过期响应直接丢弃：不覆盖新数据、不触发 searchComplete、不关闭 loading
        if (requestSeq !== latestRequestSeq) return;
        if (res.code === SUCCESS_CODE && res.data) {
          if (searchResultFormat && typeof searchResultFormat === "function") {
            dataList.value = searchResultFormat(res.data.results);
          } else {
            dataList.value = isTree
              ? handleTree(res.data.results)
              : res.data.results;
          }
          tablePagination.value.total = res.data.total;
          if (options.inline) {
            if (res.data.search_columns || res.data.search_fields) {
              getColumnData(
                null,
                null,
                columnsInitCallback,
                fieldsInitCallback,
                {},
                {},
                {
                  search_columns: res.data.search_columns,
                  search_fields: res.data.search_fields
                }
              );
            } else {
              // 旧后端/未混入元数据 Action：回退分离请求
              options.onInlineMetaMissing?.();
            }
          }
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        emit("searchComplete", { routeParams, searchFields, dataList, res });
        loadingStatus.value = false;
      })
      .catch(() => {
        // 过期请求的失败同样忽略；其它失败的提示由 http 层统一给出，此处只收尾 loading
        if (requestSeq !== latestRequestSeq) return;
        loadingStatus.value = false;
      });
  };
}
