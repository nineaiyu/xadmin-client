import { computed, h } from "vue";
import { ElProgress, ElTag } from "element-plus";
import { statusTagProps } from "@/utils/dict";
import {
  formatPageColumns,
  type PageColumn,
  type PageTableColumn
} from "@/components/RePlusPage";
import {
  PRODUCT_TAG_TYPE,
  asExecutionRow,
  statusValue
} from "./taskExecutionTypes";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 执行历史列渲染（自 hook.tsx 抽出）：产物类型 / 业务名 / 状态 /
 * 进度与阶段 / 耗时；搜索区「记录类型」选项文案走前端词条
 * （后端 choices 为英文 msgid，无中文翻译包）。
 */
export function buildTaskExecutionColumns({ t }: { t: TFunction }) {
  const searchColumnsFormat = (columns: PageColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key !== "product_type") return;
      column.options = computed(() => [
        { label: t("taskCenter.type_task"), value: "task" },
        { label: t("taskCenter.type_export"), value: "export" },
        { label: t("taskCenter.type_import"), value: "import" }
      ]);
    });
    return columns;
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      product_type: column => {
        // 产物类型：导出/导入任务与执行记录共用主键，此处一次性表达三类记录
        column.cellRenderer = ({ row }) => {
          const type = asExecutionRow(row).product_type || "task";
          return h(
            ElTag,
            { size: "small", type: PRODUCT_TAG_TYPE[type] ?? "primary" },
            () => t(`taskCenter.type_${type}`)
          );
        };
      },
      name: column => {
        // 产物任务优先展示业务名（如「用户导出-20260924」），其余展示任务路径
        column.cellRenderer = ({ row }) => {
          const data = asExecutionRow(row);
          const text = data.product_name || data.name || "";
          return h("span", { title: text }, text);
        };
      },
      status: column => {
        // 字典驱动（DictChoiceField）：颜色/文案管理员可在数据字典 task_status
        // 维护；字典未配置回退枚举时无 color，由 statusTagProps 走本地映射兜底
        column.cellRenderer = ({ row }) => {
          const data = asExecutionRow(row);
          const status = data.status;
          const value = statusValue(data);
          return h(
            ElTag,
            statusTagProps(status),
            () =>
              (typeof status === "object" && status ? status.label : null) ??
              t(`systemTaskExecution.status${value}`)
          );
        };
      },
      product_progress: column => {
        // 进度与阶段仅产物任务有语义；执行类任务无进度（统一进度助手口径）
        column.cellRenderer = ({ row }) => {
          const data = asExecutionRow(row);
          if (!data.product_type) return h("span", "—");
          const value = statusValue(data);
          const nodes = [
            h(ElProgress, {
              percentage: Number(data.product_progress ?? 0),
              status:
                value === "FAILURE" || value === "REVOKED"
                  ? "exception"
                  : value === "SUCCESS"
                    ? "success"
                    : undefined
            })
          ];
          if (data.product_stage) {
            nodes.push(
              h(
                "div",
                { class: "text-xs text-(--el-text-color-secondary)" },
                data.product_stage
              )
            );
          }
          return h("div", nodes);
        };
      },
      time_cost: column => {
        column.cellRenderer = ({ row }) => {
          const cost = asExecutionRow(row).time_cost;
          return h(
            "span",
            cost === null || cost === undefined ? "—" : `${cost}s`
          );
        };
      }
    });

  return { listColumnsFormat, searchColumnsFormat };
}
