import {
  formatPublicLabels,
  uniqueArrayObj,
  type OperationButtonsRow
} from "@/components/RePlusPage";
import { renderSwitch } from "./handle";
import { OPERATION_COLUMN_KEY, SELECTION_COLUMN_KEY } from "./constants";
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
  switchStyle
}: {
  listColumns: Ref<PageColumn[]>;
  t: TFunction;
  api: Partial<{ partialUpdate: unknown }>;
  auth: { partialUpdate?: unknown; update?: unknown };
  switchLoadMap: Ref<Record<string, unknown>>;
  switchStyle: unknown;
}) {
  listColumns.value.forEach((column: PageColumn) => {
    switch (column._column?.input_type) {
      case "boolean":
        // pure-table ****** start
        column["cellRenderer"] = renderSwitch({
          t,
          updateApi: api.partialUpdate as never,
          switchLoadMap,
          switchStyle: switchStyle as never,
          field: column.prop,
          disabled: () => !(auth.partialUpdate || auth.update)
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
  const hasOperations = uniqueArrayObj(getOperationButtons(), "code").filter(
    (item: OperationButtonsRow) => item?.show
  );
  if (!(operation && hasOperations.length > 0)) return;
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
    width: operationButtonsProps?.width ?? 200,
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
