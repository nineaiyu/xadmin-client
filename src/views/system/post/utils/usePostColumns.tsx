import { h } from "vue";
import { ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { PostItem } from "@/api/identity/post";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 岗位列表列渲染（自 hook.tsx 抽出）：启停用列为只读标签（关闭框架
 * partialUpdate 后默认开关恒禁用，避免双入口），成员数走计数标签。
 */
export function usePostColumns({ t }: { t: TFunction }) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      is_active: column => {
        column["cellRenderer"] = ({ row }) =>
          (row as PostItem).is_active
            ? h(ElTag, { size: "small", type: "success" }, () =>
                t("post.enabled")
              )
            : h(ElTag, { size: "small", type: "info" }, () =>
                t("post.disabled")
              );
      },
      user_count: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElTag, { size: "small", type: "primary" }, () =>
            String((row as PostItem).user_count ?? 0)
          );
      }
    });

  return { listColumnsFormat };
}
