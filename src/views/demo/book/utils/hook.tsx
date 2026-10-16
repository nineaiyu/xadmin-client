import { bookApi } from "./api";
import { reactive, type Ref } from "vue";
import { usePageAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { useBookColumns } from "./bookColumns";
import { useBookFormColumns } from "./bookFormColumns";
import { useBookButtons } from "./bookButtons";

/**
 * 书籍列表装配：列渲染见 bookColumns.tsx，表单与搜索区列见 bookFormColumns.ts，
 * 按钮见 bookButtons.ts。
 */
export function useDemoBook(tableRef: Ref) {
  // 权限判断：recycleList 控制回收站入口、changeHistory 控制行级变更历史
  const api = reactive(bookApi);
  const auth = usePageAuth(["push", "submit", "recycleList", "changeHistory"]);
  const { t } = useI18n();

  const { listColumnsFormat } = useBookColumns();
  const { addOrEditOptions, searchColumnsFormat } = useBookFormColumns(t);
  const { operationButtonsProps, tableBarButtonsProps } = useBookButtons({
    t,
    api,
    auth,
    tableRef
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    searchColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
