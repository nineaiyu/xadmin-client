import { bookApi } from "./api";
import { defineListPage, type PageColumn } from "@/components/RePlusPage";
import { useBookColumns } from "./bookColumns";
import { useBookFormColumns } from "./bookFormColumns";
import { useBookButtons } from "./bookButtons";

/**
 * 书籍列表装配：列渲染见 bookColumns.tsx，表单与搜索区列见 bookFormColumns.ts，
 * 按钮见 bookButtons.ts。
 */
export function useDemoBook() {
  // 搜索区列格式化不在工厂返回契约内（页面专属扩展位），由表单装配时捕获
  let searchColumnsFormat!: (columns: PageColumn[]) => PageColumn[];

  const page = defineListPage({
    // 权限判断：recycleList 控制回收站入口、changeHistory 控制行级变更历史
    api: bookApi,
    localeName: "demoBook",
    extraAuth: [
      "push",
      "submit",
      "recycleList",
      "recycleRestore",
      "recyclePurge",
      "changeHistory"
    ],
    columns: ({ columns }) => useBookColumns().listColumnsFormat(columns),
    formOptions: ({ t }) => {
      const bookFormColumns = useBookFormColumns(t);
      searchColumnsFormat = bookFormColumns.searchColumnsFormat;
      return bookFormColumns.addOrEditOptions;
    },
    buttons: ({ t, api, auth, tableRef }) =>
      useBookButtons({
        t,
        api,
        auth,
        tableRef
      })
  });

  return { ...page, searchColumnsFormat };
}
