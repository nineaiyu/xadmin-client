import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import {
  formatPublicLabels,
  usePublicHooks,
  uniqueArrayObj
} from "@/components/RePlusPage";
import type { PageColumn, RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import { renderSwitch } from "./handle";

type TFunction = ReturnType<typeof useI18n>["t"];
type TeFunction = ReturnType<typeof useI18n>["te"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/** 列表列渲染：boolean 列开关渲染器、多选/操作列注入与三类列格式化出口（拆分自 hook.tsx，行为不变） */
export function usePlusPageColumns({
  props,
  t,
  te,
  listColumns,
  detailColumns,
  searchColumns,
  addOrEditRules,
  addOrEditColumns,
  searchDefaultValue,
  addOrEditDefaultValue,
  switchLoadMap,
  getOperationButtons
}: {
  props: RePlusPageProps;
  t: TFunction;
  te: TeFunction;
  listColumns: BaseColumnsReturn["listColumns"];
  detailColumns: BaseColumnsReturn["detailColumns"];
  searchColumns: BaseColumnsReturn["searchColumns"];
  addOrEditRules: BaseColumnsReturn["addOrEditRules"];
  addOrEditColumns: BaseColumnsReturn["addOrEditColumns"];
  searchDefaultValue: BaseColumnsReturn["searchDefaultValue"];
  addOrEditDefaultValue: BaseColumnsReturn["addOrEditDefaultValue"];
  switchLoadMap: Ref<Record<string, unknown>>;
  /** 操作列可见按钮集合（buttons 子 hook 晚于本 hook 初始化，经 getter 延迟取值） */
  getOperationButtons: () => OperationButtonsRow[];
}) {
  const {
    api,
    auth,
    localeName,
    selection,
    operation,
    operationButtonsProps,
    listColumnsFormat,
    detailColumnsFormat,
    searchColumnsFormat,
    baseColumnsFormat
  } = props;
  const { switchStyle } = usePublicHooks();

  // 表格字段自定义渲染
  const formatColumnsRender = () => {
    listColumns.value.forEach((column: PageColumn) => {
      switch (column._column?.input_type) {
        case "boolean":
          // pure-table ****** start
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.partialUpdate,
            switchLoadMap,
            switchStyle,
            field: column.prop,
            disabled: () => !(auth.partialUpdate || auth.update)
          });
          break;
        // pure-table ****** end
      }
    });
    if (selection) {
      listColumns.value.unshift({
        _column: { key: "selection" },
        type: "selection",
        fixed: "left",
        reserveSelection: true
      });
    }
    const hasOperations = uniqueArrayObj(getOperationButtons(), "code").filter(
      (item: OperationButtonsRow) => item?.show
    );
    if (operation && hasOperations.length > 0) {
      listColumns.value.push({
        _column: { key: "operation" },
        label: formatPublicLabels(t, te, "operation", localeName),
        fixed: "right",
        width: operationButtonsProps?.width ?? 200,
        slot: "operation"
      });
    }
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
  };

  return { formatColumnsRender };
}
