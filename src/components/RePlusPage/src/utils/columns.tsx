import { computed, ref } from "vue";
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

import { formatPublicLabels } from "./index";
import { formatAddOrEditOptions } from "./renders";
import { getApiSearchComponents } from "./apiSearch";
import { isEmail, isNumber } from "@pureadmin/utils";

import Info from "~icons/ri/question-line";

/**
 * @description 用与通过api接口，获取对应的column, 进行前端渲染
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
  const addOrEditColumns = ref([]);
  const addOrEditDefaultValue = ref<Record<string, unknown>>({});
  const searchColumns = ref([]);
  const searchDefaultValue = ref<Record<string, unknown>>({});
  const listColumns = ref([]);
  const detailColumns = ref([]);
  const { t, te } = useI18n();

  /** 组装列渲染器上下文 */
  const buildContext = (column: PlusColumnMeta): PlusColumnContext => ({
    column,
    t,
    te,
    localeName,
    apiSearchComponents
  });

  /**
   * 降级处理：后端关联列的 choices 超过 SEARCH_CHOICES_MAX_COUNT 时会被截断，
   * 并带出 choices_truncated 标记。此时下拉必须开启本地过滤，并在开发环境提示
   * 开发者将该字段改为 api-search-* 远程搜索组件（SearchUser/SearchDept/SearchRole 模式）。
   */
  const applyChoicesTruncated = (column: PlusColumnMeta, item: PageColumn) => {
    if (!column?.choices_truncated) return;
    item.fieldProps = { ...(item.fieldProps ?? {}), filterable: true };
    if (import.meta.env.DEV) {
      console.warn(
        `[RePlusPage] 字段 "${column.key}" 的 choices 已被后端截断，` +
          `请为其自定义 input_type="api-search-*" 以启用远程搜索`
      );
    }
  };

  const formatSearchColumns = (columns: SearchFieldsResult["data"]) => {
    columns.forEach(column => {
      const item: PageColumn = {
        _column: column,
        label:
          formatPublicLabels(t, te, column.key, localeName) ?? column.label,
        prop: column.key,
        tooltip: column?.help_text,
        options: computed(() => formatAddOrEditOptions(column.choices)),
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
    const message =
      formatPublicLabels(t, te, column.key, localeName) ?? column.label;
    switch (column.input_type) {
      case "email":
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            validator: (
              rule: unknown,
              value: unknown,
              callback: (error?: Error) => void
            ) => {
              if (value === "" || !value) {
                callback();
              } else if (!isEmail(value as string)) {
                callback(new Error(message));
              } else {
                callback();
              }
            },
            trigger: "blur"
          }
        ];
        break;
      case "integer":
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            validator: (
              rule: unknown,
              value: unknown,
              callback: (error?: Error) => void
            ) => {
              if (value && !isNumber(value)) {
                callback(new Error("field must be a number"));
              } else {
                callback();
              }
            },
            trigger: "blur"
          }
        ];
        break;
      default:
        addOrEditRules.value[column.key] = [
          {
            required: column.required,
            message: message,
            trigger: "blur"
          }
        ];
    }
  };

  const formatAddOrEditColumns = (columns: SearchColumnsResult["data"]) => {
    columns.forEach(column => {
      formatAddOrEditRules(column);
      const item: PageColumn = {
        _column: column,
        prop: column.key,
        label:
          formatPublicLabels(t, te, column.key, localeName) ?? column.label,
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
        addOrEditDefaultValue.value[column.key] = column?.default;
        if (column.input_type === "labeled_choice") {
          addOrEditDefaultValue.value[column.key] = { value: column?.default };
        }
        if (column.input_type === "labeled_multiple_choice") {
          addOrEditDefaultValue.value[column.key] = [
            { value: column?.default }
          ];
        }
        if (column.input_type === "multiple choice") {
          addOrEditDefaultValue.value[column.key] = [column?.default];
        }
      }
      if (!column.write_only) {
        let input_type = column.input_type;
        if (input_type.startsWith("api-search-")) {
          // 详情渲染自定义api-search
          input_type = "object_related_field";
          if (column.multiple) {
            input_type = "m2m_related_field";
          }
        }
        getDetailRenderer(input_type)?.(item, buildContext(column));
        detailColumns.value.push(cloneDeep(item));
        if (column.table_show) {
          listColumns.value.push(cloneDeep(item));
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
    apiColumns: BaseApi["columns"],
    apiFields: BaseApi["fields"],
    columnsCallback = null,
    fieldsCallback = null,
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
