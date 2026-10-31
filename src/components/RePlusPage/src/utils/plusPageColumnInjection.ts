import { formatPublicLabels, uniqueArrayObj } from "./index";
import type { OperationButtonsRow } from "../components/ButtonOperation";
import { renderBooleanTag, renderSwitch } from "./handle";
import { OPERATION_COLUMN_KEY, SELECTION_COLUMN_KEY } from "./constants";
import { DEFAULT_OPERATION_COLUMN_WIDTH } from "./operationColumnWidth";
import type { Ref } from "vue";
import type { PageColumn, RePlusPageProps } from "./types";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type TeFunction = ReturnType<typeof useI18n>["te"];
type BaseColumnsReturn = ReturnType<typeof import("./columns").useBaseColumns>;

/** boolean 列的开关渲染（自 usePlusPageColumns.ts 抽出） */
export function applyBooleanColumnRenderers({
  listColumns,
  t,
  api,
  auth,
  switchLoadMap,
  switchStyle,
  tagStyle
}: {
  listColumns: Ref<PageColumn[]>;
  t: TFunction;
  api: Partial<{ partialUpdate: unknown }>;
  auth: { partialUpdate?: unknown; update?: unknown };
  switchLoadMap: Ref<Record<string, unknown>>;
  switchStyle: unknown;
  tagStyle: Ref<(status: boolean) => Record<string, string>>;
}) {
  listColumns.value.forEach((column: PageColumn) => {
    switch (column._column?.input_type) {
      case "boolean":
        // pure-table ****** start
        // 元数据 read_only（如 SerializerMethodField）只展示标签，不能发 PATCH
        if (column._column?.read_only) {
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle: tagStyle as never,
            field: column.prop
          });
          break;
        }
        column["cellRenderer"] = renderSwitch({
          t,
          updateApi: api.partialUpdate as never,
          switchLoadMap,
          switchStyle: switchStyle as never,
          field: column.prop,
          // 权限位 + 行级 is_owner（与编辑/删除按钮同口径；后端仍兜底）
          disabled: (row?: Record<string, unknown>) =>
            !(auth.partialUpdate || auth.update) || row?.is_owner === false
        });
        break;
      // pure-table ****** end
    }
  });
}

/** 多选列注入（自 usePlusPageColumns.ts 抽出） */
export function injectSelectionColumn(
  listColumns: Ref<PageColumn[]>,
  selection: RePlusPageProps["selection"]
) {
  if (!selection) return;
  listColumns.value.unshift({
    _column: { key: SELECTION_COLUMN_KEY },
    type: "selection",
    fixed: "left",
    reserveSelection: true
  });
}

/** 操作列注入（自 usePlusPageColumns.ts 抽出）：无可显示按钮时不注入 */
export function injectOperationColumn({
  listColumns,
  props,
  t,
  te,
  getOperationButtons
}: {
  listColumns: Ref<PageColumn[]>;
  props: RePlusPageProps;
  t: TFunction;
  te: TeFunction;
  getOperationButtons: () => OperationButtonsRow[];
}) {
  const { operation, operationButtonsProps, localeName } = props;
  const auth = props.auth ?? {};
  const hasPermissionButton = Boolean(
    auth.update || auth.partialUpdate || auth.destroy || auth.changeHistory
  );
  const showDetail = operationButtonsProps?.hideDetail !== true;
  const hasOperations = uniqueArrayObj(getOperationButtons(), "code").filter(
    (item: OperationButtonsRow) => {
      if (typeof item?.show === "function") return hasPermissionButton;
      return typeof item?.show === "boolean" ? item.show : hasPermissionButton;
    }
  );
  // 详情默认按钮不依赖写权限；其余按钮都要求至少一个操作权限位，
  // 否则「仅 list 权限 + hideDetail」会注入一条永远空白的操作列
  if (!(operation && (showDetail || hasOperations.length > 0))) return;
  listColumns.value.push({
    _column: { key: OPERATION_COLUMN_KEY },
    label:
      formatPublicLabels(
        t as (arg0: string, arg1?: object) => string,
        te as (arg0: string, arg1?: string) => boolean,
        "operation",
        localeName ?? ""
      ) ?? "",
    fixed: "right",
    // 配置宽度即列宽上限；实际宽度由 useTableLayout 按容器与内容收敛
    width: operationButtonsProps?.width ?? DEFAULT_OPERATION_COLUMN_WIDTH,
    slot: "operation"
  });
}

/** 三类列的页面格式化出口 + 页面级列回调（自 usePlusPageColumns.ts 抽出） */
export function applyColumnFormats({
  props,
  listColumns,
  detailColumns,
  searchColumns,
  addOrEditRules,
  addOrEditColumns,
  searchDefaultValue,
  addOrEditDefaultValue
}: {
  props: RePlusPageProps;
  listColumns: Ref<PageColumn[]>;
  detailColumns: Ref<PageColumn[]>;
  searchColumns: Ref<PageColumn[]>;
  addOrEditRules: BaseColumnsReturn["addOrEditRules"];
  addOrEditColumns: BaseColumnsReturn["addOrEditColumns"];
  searchDefaultValue: BaseColumnsReturn["searchDefaultValue"];
  addOrEditDefaultValue: BaseColumnsReturn["addOrEditDefaultValue"];
}) {
  const {
    listColumnsFormat,
    detailColumnsFormat,
    searchColumnsFormat,
    baseColumnsFormat
  } = props;
  listColumns.value =
    (listColumnsFormat && listColumnsFormat(listColumns.value)) ||
    listColumns.value;
  detailColumns.value =
    (detailColumnsFormat && detailColumnsFormat(detailColumns.value)) ||
    detailColumns.value;
  searchColumns.value =
    (searchColumnsFormat && searchColumnsFormat(searchColumns.value)) ||
    searchColumns.value;

  if (baseColumnsFormat) {
    baseColumnsFormat({
      listColumns,
      detailColumns,
      searchColumns,
      addOrEditRules,
      addOrEditColumns,
      searchDefaultValue,
      addOrEditDefaultValue
    });
  }
}
