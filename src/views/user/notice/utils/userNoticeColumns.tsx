import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 我的通知列渲染（自 hook.tsx 抽出）：标题（字典驱动 notice_level，字典色优先
 * el-text style，无色回退枚举值即 el-text 类型的契约）与已读状态。
 */
export function useUserNoticeColumns({ t }: { t: TFunction }) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-text
            type={row.level?.value}
            style={row.level?.color ? { color: row.level.color } : undefined}
          >
            {row.title}
          </el-text>
        );
      },
      unread: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-text type={row.unread ? "success" : "info"}>
            {row.unread ? t("labels.unread") : t("labels.read")}
          </el-text>
        );
      }
    });

  return { listColumnsFormat };
}
