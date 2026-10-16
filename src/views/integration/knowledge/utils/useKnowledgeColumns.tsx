import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { KnowledgeRow } from "./useKnowledgeDocument";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 知识库列渲染（自 knowledge/utils/hook 抽出）：标题入口 + 只读启停状态标签 */
export function useKnowledgeColumns({
  t,
  openKnowledgePanel
}: {
  t: TFunction;
  openKnowledgePanel: (row: KnowledgeRow) => void;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
        // 文档标题同为抽屉入口（预览/启停/删除都在抽屉内）
        column["cellRenderer"] = ({ row }) => {
          const item = row as KnowledgeRow;
          return h(
            ElLink,
            {
              type: "primary",
              onClick: () => openKnowledgePanel(item)
            },
            () => item.title
          );
        };
      },
      is_active: column => {
        // 只读状态标签：启停入口唯一收敛到抽屉（避免与禁用开关并存）
        column["cellRenderer"] = ({ row, props }) => {
          const active = Boolean((row as KnowledgeRow).is_active);
          return h(
            ElTag,
            {
              type: active ? "success" : "danger",
              size: props.size,
              effect: "plain"
            },
            () =>
              active ? t("aiKnowledge.enabled") : t("aiKnowledge.disabled")
          );
        };
      }
    });

  return { listColumnsFormat };
}
