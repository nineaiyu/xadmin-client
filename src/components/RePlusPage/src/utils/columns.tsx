import { computed, ref } from "vue";
import type { Ref } from "vue";
// 注意：这里的列对象在挂载 renderer/computed 之后就地深拷贝，含循环引用——
// 必须用 lodash-es 的 cloneDeep（带环检测）；@pureadmin/utils 的同名实现会爆栈
import { cloneDeep } from "lodash-es";
import { useI18n } from "vue-i18n";
import type { BaseApi } from "@/api/base";
import type { SearchColumnsResult, SearchFieldsResult } from "@/api/types";
import {
  getDetailRenderer,
  getFormRenderer,
  getSearchRenderer
} from "./registry";
import type { PageColumn, PlusColumnContext, PlusColumnMeta } from "./types";

import {
  applyChoicesTruncated,
  buildColumnRule,
  columnDefaultValue,
  detailInputType,
  resolveColumnLabel
} from "./columnRules";
import { formatAddOrEditOptions } from "./renders";
import { getApiSearchComponents } from "./apiSearch";

import Info from "~icons/ri/question-line";

/**
 * @description 用与通过api接口，获取对应的column, 进行前端渲染。
 * 纯函数段（展示名兜底 / choices 截断降级 / 校验规则 / 默认值形态 / 详情类型映射）
 * 见同目录 columnRules.ts；本 hook 只负责装配流程与回调时序。
 */
export function useBaseColumns(localeName: string) {
  /**
   * @description 自定义搜索模板（`api-search-*`）
   *
   * 组件由业务侧在应用启动时注册（见 `@/views/system/apiSearch`），
   * 框架层不再反向 import 业务页面组件。
   */
  const apiSearchComponents = getApiSearchComponents();

  const addOrEditRules = ref<Record<string, unknown>>({});
  const addOrEditColumns = ref<PageColumn[]>([]);
  const addOrEditDefaultValue = ref<Record<string, unknown>>({});
  const searchColumns = ref<PageColumn[]>([]);
  const searchDefaultValue = ref<Record<string, unknown>>({});
  const listColumns = ref<PageColumn[]>([]);
  const detailColumns = ref<PageColumn[]>([]);
  const { t, te } = useI18n();

  /** 组装列渲染器上下文 */
  const buildContext = (column: PlusColumnMeta): PlusColumnContext => ({
    column,
    t,
    te,
    localeName,
    apiSearchComponents
  });

  const formatSearchColumns = (columns: SearchFieldsResult["data"]) => {
    columns.forEach(column => {
      const item: PageColumn = {
        _column: column,
        label: resolveColumnLabel({ t, te, localeName }, column),
        prop: column.key,
        tooltip: column?.help_text,
        options: computed(() => formatAddOrEditOptions(column.choices ?? [])),
        valueType: "input",
        fieldProps: {},
        hideInForm: true,
        hideInTable: true
      };
      getSearchRenderer(column.input_type)(item, buildContext(column));
      applyChoicesTruncated(column, item);
      searchDefaultValue.value[column.key] = column?.default;
      searchColumns.value.push(item);
    });
  };

  const formatAddOrEditRules = (column: SearchColumnsResult["data"][0]) => {
    addOrEditRules.value[column.key] = buildColumnRule(
      column,
      resolveColumnLabel({ t, te, localeName }, column)
    );
  };

  const formatAddOrEditColumns = (columns: SearchColumnsResult["data"]) => {
    columns.forEach(column => {
      formatAddOrEditRules(column);
      const item: PageColumn = {
        _column: column,
        prop: column.key,
        label: resolveColumnLabel({ t, te, localeName }, column),
        tooltip: column?.help_text,
        minWidth: 120,
        fieldProps: {
          maxlength: column?.max_length,
          showWordLimit: true,
          multiple: column?.multiple
        },
        hideInSearch: true,
        hideInTable: false,
        // pure-table ****** start
        showOverflowTooltip: true,
        cellRenderer: ({ row }) => (
          <span v-copy={row[column.key]}>{row[column.key]}</span>
        )
        // pure-table ****** end
      };
      // pure-table ****** start
      if (column?.help_text) {
        item["headerRenderer"] = () => (
          <span class="flex-c">
            {item.label}
            <iconifyIconOffline
              icon={Info}
              class={["ml-1"]}
              v-tippy={{
                content: column?.help_text
              }}
            />
          </span>
        );
      }
      // pure-table ****** end
      getFormRenderer(column.input_type)(item, buildContext(column));
      applyChoicesTruncated(column, item);

      if (column.key === "description") {
        item.valueType = "textarea";
        item["fieldProps"] = { autosize: { minRows: 3 } };
      }
      if (!column.read_only) {
        addOrEditColumns.value.push(cloneDeep(item));
      }

      if (column.hasOwnProperty("default")) {
        addOrEditDefaultValue.value[column.key] = columnDefaultValue(column);
      }
      if (!column.write_only) {
        getDetailRenderer(detailInputType(column))?.(
          item,
          buildContext(column)
        );
        detailColumns.value.push(cloneDeep(item));
        if (column.table_show) {
          const tableItem = cloneDeep(item);
          // 表头排序：仅元数据声明 sortable 的列开启，排序走服务端 ordering 参数
          if (column.sortable) tableItem.sortable = "custom";
          // 受控高级筛选：透传字段级可用 lookup（未下发的字段不进入候选）
          if (column.lookups?.length) tableItem.lookups = column.lookups;
          listColumns.value.push(tableItem);
        }
      }
    });
    // table_show 可能缺失：兜底 0，避免 NaN 参与相减导致排序结果不稳定
    listColumns.value = listColumns.value.sort(
      (a, b) => (a._column.table_show ?? 0) - (b._column.table_show ?? 0)
    );
  };

  /**
   * 该方法用于页面onMount内调用，用于第一次渲染页面
   */
  const getColumnData = async (
    apiColumns: BaseApi["columns"] | null | undefined,
    apiFields: BaseApi["fields"] | null | undefined,
    columnsCallback:
      | ((payload: {
          listColumns: Ref<PageColumn[]>;
          detailColumns: Ref<PageColumn[]>;
          addOrEditRules: Ref<Record<string, unknown>>;
          addOrEditColumns: Ref<PageColumn[]>;
          addOrEditDefaultValue: Ref<Record<string, unknown>>;
        }) => void)
      | null = null,
    fieldsCallback:
      | ((payload: {
          searchDefaultValue: Ref<Record<string, unknown>>;
          searchColumns: Ref<PageColumn[]>;
        }) => void)
      | null = null,
    columnsParams: object = {},
    fieldsParams: object = {},
    /** with_meta=1 内联载荷，存在时跳过对应分离请求 */
    inlineMeta?: {
      search_columns?: SearchColumnsResult["data"];
      search_fields?: SearchFieldsResult["data"];
    }
  ) => {
    if (inlineMeta?.search_fields) {
      searchColumns.value.splice(0, searchColumns.value.length);
      formatSearchColumns(inlineMeta.search_fields);
      if (fieldsCallback) {
        fieldsCallback({ searchDefaultValue, searchColumns });
      }
    } else if (apiFields) {
      const res = await apiFields(fieldsParams);
      searchColumns.value.splice(0, searchColumns.value.length);
      formatSearchColumns(res.data);
      if (fieldsCallback) {
        fieldsCallback({ searchDefaultValue, searchColumns });
      }
    }
    if (inlineMeta?.search_columns) {
      detailColumns.value.splice(0, detailColumns.value.length);
      addOrEditColumns.value.splice(0, addOrEditColumns.value.length);
      listColumns.value.splice(0, listColumns.value.length);
      formatAddOrEditColumns(inlineMeta.search_columns);
      if (columnsCallback) {
        columnsCallback({
          listColumns,
          detailColumns,
          addOrEditRules,
          addOrEditColumns,
          addOrEditDefaultValue
        });
      }
    } else if (apiColumns) {
      apiColumns(columnsParams).then(res => {
        detailColumns.value.splice(0, detailColumns.value.length);
        addOrEditColumns.value.splice(0, addOrEditColumns.value.length);
        listColumns.value.splice(0, listColumns.value.length);
        formatAddOrEditColumns(res.data);
        if (columnsCallback) {
          columnsCallback({
            listColumns,
            detailColumns,
            addOrEditRules,
            addOrEditColumns,
            addOrEditDefaultValue
          });
        }
      });
    }
  };

  return {
    listColumns,
    detailColumns,
    searchColumns,
    getColumnData,
    addOrEditRules,
    addOrEditColumns,
    searchDefaultValue,
    addOrEditDefaultValue
  };
}
