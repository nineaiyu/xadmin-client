import { h } from "vue";
import { ElTag } from "element-plus";
import {
  formatPageColumns,
  type PageColumn,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { DynamicFormItem } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 表单设计列表列渲染（自 hook.tsx 抽出）：schema 列渲染「字段数」；
 * is_active / approval_required 渲染为语义 tag（覆盖框架对 boolean 列的
 * 自动开关渲染，与迁移前标签口径一致）；详情抽屉不渲染 schema 列。
 */
export function useDesignerColumns({ t }: { t: TFunction }) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      schema: column => {
        column["cellRenderer"] = ({ row }) =>
          h("span", String((row as DynamicFormItem).schema_fields_count ?? 0));
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) => {
          const active = (row as DynamicFormItem).is_active;
          return h(
            ElTag,
            { size: "small", type: active ? "success" : "info" },
            () => (active ? t("dform.active") : t("dform.inactive"))
          );
        };
      },
      approval_required: column => {
        column["cellRenderer"] = ({ row }) => {
          const required = (row as DynamicFormItem).approval_required;
          return h(
            ElTag,
            { size: "small", type: required ? "warning" : "info" },
            () => (required ? t("dform.approvalOn") : t("dform.approvalOff"))
          );
        };
      }
    });

  /** 详情抽屉不渲染 schema 列：列表行不含 schema 全文（只带字段数），避免空行 */
  const detailColumnsFormat = (columns: PageColumn[]) =>
    columns.filter(column => column._column?.key !== "schema");

  return { listColumnsFormat, detailColumnsFormat };
}
