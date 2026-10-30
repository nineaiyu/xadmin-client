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
  openKnowledgePanel,
  canRetrieve
}: {
  t: TFunction;
  openKnowledgePanel: (row: KnowledgeRow) => void;
  /** 无 retrieve 权限时标题退化为纯文本（与行内预览按钮同口径） */
  canRetrieve: boolean;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      title: column => {
        // 文档标题同为抽屉入口（预览/启停/删除都在抽屉内）
        column["cellRenderer"] = ({ row }) => {
          const item = row as KnowledgeRow;
          if (!canRetrieve) return item.title;
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
      ingest_status: column => {
        // 上传文档走后台摄取：队列中/处理中/失败即时可见（失败原因悬浮在 tag 上）
        column["cellRenderer"] = ({ row, props }) => {
          const item = row as { ingest_status?: string; ingest_error?: string };
          const status = String(item.ingest_status || "SUCCESS");
          const conf: Record<
            string,
            { type: "success" | "warning" | "danger" | "info"; key: string }
          > = {
            PENDING: { type: "info", key: "aiKnowledge.ingestPending" },
            PROCESSING: {
              type: "warning",
              key: "aiKnowledge.ingestProcessing"
            },
            SUCCESS: { type: "success", key: "aiKnowledge.ingestDone" },
            FAILED: { type: "danger", key: "aiKnowledge.ingestFailed" }
          };
          const resolved = conf[status] ?? conf.SUCCESS;
          return h(
            ElTag,
            {
              type: resolved.type,
              size: props.size,
              effect: "plain",
              title:
                status === "FAILED" ? item.ingest_error || undefined : undefined
            },
            () => t(resolved.key)
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
