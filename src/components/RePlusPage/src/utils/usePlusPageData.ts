import { message } from "@/utils/message";
import type { Ref } from "vue";
import { toRaw } from "vue";
import { cloneDeep, isArray } from "@pureadmin/utils";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import { handleTree } from "@/utils/tree";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/** 请求与分页：搜索字段装配、请求序号防过期、分页/搜索事件与首开元数据编排（拆分自 hook.tsx，行为不变） */
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
  searchFields: Ref<{ size?: number; page?: number }>;
  defaultValue: Ref<Record<string, unknown>>;
  tablePagination: Ref<RePlusPageProps["pagination"]>;
  getColumnData: BaseColumnsReturn["getColumnData"];
  searchDefaultValue: BaseColumnsReturn["searchDefaultValue"];
  columnsInitCallback: () => void;
}) {
  const { api, auth, isTree, beforeSearchSubmit, searchResultFormat } = props;

  const initSearchFields = () => {
    searchFields.value = cloneDeep(defaultValue.value);
    tablePagination.value.pageSize = searchFields.value.size;
    tablePagination.value.currentPage = searchFields.value.page;
  };

  const handleReset = () => {
    initSearchFields();
    handleGetData();
  };

  const handleSearch = async () => {
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

  // 数据获取
  // 请求序号：仅接受最新一次请求的响应，避免同页快速切换筛选/分页时旧响应覆盖新列表
  let latestRequestSeq = 0;
  const handleGetData = (
    queryParams = {},
    options: {
      /** 首开内联元数据消费（with_meta=1 响应中的 search_columns/search_fields） */
      inline?: boolean;
      /** 内联响应缺元数据键时的一次性回退（旧后端/无元数据 Action 视图集） */
      onInlineMetaMissing?: () => void;
    } = {}
  ) => {
    const requestSeq = ++latestRequestSeq;
    loadingStatus.value = true;

    ["created_time", "updated_time"].forEach(key => {
      if (searchFields.value[key]?.length === 2) {
        searchFields.value[`${key}_after`] = searchFields.value[key][0];
        searchFields.value[`${key}_before`] = searchFields.value[key][1];
      } else {
        searchFields.value[`${key}_after`] = "";
        searchFields.value[`${key}_before`] = "";
      }
    });

    const params = cloneDeep(toRaw({ ...searchFields.value, ...queryParams }));

    // 该方法为了支持pk多选操作将如下格式 [{pk:1},{pk:2}] 转换为 [1,2]
    Object.keys(params).forEach(key => {
      const value = params[key];
      const pks = [];
      if (isArray(value)) {
        value.forEach(item => {
          if (item.pk ?? item.id) {
            pks.push(item.pk ?? item.id);
          }
        });
        if (pks.length > 0) {
          params[key] = pks;
        }
      }
    });

    const data = (beforeSearchSubmit && beforeSearchSubmit(params)) || params;

    api
      .list(data)
      .then(res => {
        // 过期响应直接丢弃：不覆盖新数据、不触发 searchComplete、不关闭 loading
        if (requestSeq !== latestRequestSeq) return;
        if (res.code === 1000 && res.data) {
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
                undefined,
                undefined,
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

  /** 搜索表单默认值装配（fieldsCallback 与 内联首开共用） */
  const fieldsInitCallback = () => {
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

  const getPageColumn = (immediate: boolean) => {
    if (immediate && auth.list && api.list) {
      // 首开以 with_meta=1 合并 list/search-columns/search-fields 三个请求；
      // 响应缺元数据键（旧后端/无元数据 Action）时回退分离请求
      handleGetData(
        { with_meta: 1 },
        {
          inline: true,
          onInlineMetaMissing: () =>
            getColumnData(
              auth.list && api.columns,
              api.fields,
              () => {
                columnsInitCallback();
                if (!api.fields && immediate) {
                  handleGetData();
                }
              },
              () => {
                fieldsInitCallback();
                if (immediate) {
                  handleGetData();
                }
              }
            )
        }
      );
      return;
    }
    getColumnData(
      auth.list && api.columns,
      api.fields,
      () => {
        columnsInitCallback();
        if (!api.fields && immediate) {
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

  return {
    handleReset,
    handleSearch,
    handleSizeChange,
    handleCurrentChange,
    handleGetData,
    getPageColumn
  };
}
