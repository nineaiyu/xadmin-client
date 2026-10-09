import { shallowRef } from "vue";
import type { PageColumn, RePlusPageProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 书籍新增/编辑与搜索区列装配（自 hook.tsx 抽出）：出版社自动补全建议词
 * （示例数据走词条，英文界面下不至于全是中文），编辑表单与搜索区共用同一份
 * 前缀匹配实现，避免两处漂移。
 */
export function useBookFormColumns(t: TFunction) {
  const fetchPublisherSuggestions = (
    queryString: string,
    cb: (results: Array<{ value: string }>) => void
  ) => {
    const queryList = [
      { value: t("demoBook.publisherExample1") },
      { value: t("demoBook.publisherExample2") },
      { value: t("demoBook.publisherExample3") }
    ];
    cb(
      queryString
        ? queryList.filter(
            item =>
              item.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0
          )
        : queryList
    );
  };

  /** 重写 publisher 组件，可参考 https://plus-pro-components.com/components/config.html */
  const formatPublisherColumn = (column: Record<string, unknown>) => {
    column.valueType = "autocomplete";
    const fieldProps = (column.fieldProps ?? {}) as Record<string, unknown>;
    fieldProps.fetchSuggestions = fetchPublisherSuggestions;
    column.fieldProps = fieldProps;
    return column;
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        publisher: ({ column }) => formatPublisherColumn(column)
      },
      tabsProps: {
        type: ""
      }
    }
  });

  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key === "publisher") formatPublisherColumn(column);
    });
    return columns;
  };

  return { addOrEditOptions, searchColumnsFormat };
}
