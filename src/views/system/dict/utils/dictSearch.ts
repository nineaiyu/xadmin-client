import type { useI18n } from "vue-i18n";
import type { PageColumn } from "@/components/RePlusPage";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 字典列表默认排序保留用户表头排序（自 hook 抽出） */
export const dictBeforeSearchSubmit = (params: Record<string, unknown>) => ({
  ...params,
  ordering: params.ordering ?? "sort,created_time"
});

/** 隐藏 is_type、parent 改名为「上级类型」（自 hook 抽出） */
export const buildDictSearchColumnsFormat =
  (t: TFunction) => (columns: PageColumn[]) =>
    columns
      .filter(column => column.prop !== "is_type")
      .map(column => {
        if (column.prop === "parent") {
          column.label = t("dataDict.parentType");
        }
        return column;
      });
