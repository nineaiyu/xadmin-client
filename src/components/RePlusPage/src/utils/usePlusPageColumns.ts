import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import { usePublicHooks } from "@/components/RePlusPage";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import {
  applyBooleanColumnRenderers,
  applyColumnFormats,
  injectOperationColumn,
  injectSelectionColumn
} from "./plusPageColumnInjection";

type TFunction = ReturnType<typeof useI18n>["t"];
type TeFunction = ReturnType<typeof useI18n>["te"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/**
 * 列表列渲染：boolean 列开关渲染器、多选/操作列注入与三类列格式化出口。
 * 注入与格式化实现见 plusPageColumnInjection.ts。
 */
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
  const { api, auth, selection } = props;
  const { switchStyle } = usePublicHooks();

  // 表格字段自定义渲染
  const formatColumnsRender = () => {
    applyBooleanColumnRenderers({
      listColumns,
      t,
      api,
      auth,
      switchLoadMap,
      switchStyle
    });
    injectSelectionColumn(listColumns, selection);
    injectOperationColumn({ listColumns, props, t, te, getOperationButtons });
    applyColumnFormats({
      props,
      listColumns,
      detailColumns,
      searchColumns,
      addOrEditRules,
      addOrEditColumns,
      searchDefaultValue,
      addOrEditDefaultValue
    });
  };

  return { formatColumnsRender };
}
