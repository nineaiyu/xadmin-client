import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { statusTagProps, type DictItem } from "@/utils/dict";
import { SUBMISSION_STATUS_TAG_TYPE } from "@/views/form/utils/submissionStatus";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { FormDataItem, FormField } from "@/api/dataset/dform";
import type { RecordType } from "plus-pro-components";
import { fieldValueText } from "./format";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 提交状态（审批回写）语义色兜底：与「我的填报」同口径（tag props 统一走 statusTagProps） */
const asRow = (row: unknown) => row as FormDataItem;

/**
 * 表单数据（管理端）表格列装配。
 * 自 useFormData 拆出（行为不变）：动态列按所选表单 schema 展开（字段值取自行数据
 * data[key]）、状态/时间列宽与渲染、搜索区移除重复的表单选择入口。
 */
export function useFormDataColumns({
  t,
  schemaFields,
  dictCache,
  userLabels
}: {
  t: TFunction;
  schemaFields: Ref<FormField[]>;
  dictCache: Record<string, DictItem[]>;
  userLabels: Record<string, string>;
}) {
  const renderFieldCell = (field: FormField, value: unknown) =>
    h(
      "span",
      { class: "text-xs" },
      fieldValueText(field, value, {
        option: (item, raw) => {
          if (!item.dict) return undefined;
          const hit = (dictCache[item.dict] ?? []).find(
            option => String(option.value ?? "") === String(raw)
          );
          return hit ? hit.label : undefined;
        },
        user: pk => userLabels[pk],
        booleanText: value => (value ? t("dform.yes") : t("dform.no")),
        tableRows: count => t("formData.tableRows", { count })
      })
    );

  /** 状态列：字典色优先、缺省按状态语义兜底；无状态（无需审批）不留空 */
  const renderStatus = (row: FormDataItem) => {
    const status = row.status;
    if (!status?.value) {
      return h(
        "span",
        { class: "text-xs text-(--el-text-color-secondary)" },
        t("dform.noApprovalNeeded")
      );
    }
    return h(
      ElTag,
      {
        size: "small",
        "data-testid": "form-data-status-tag",
        ...statusTagProps(status, SUBMISSION_STATUS_TAG_TYPE)
      },
      () => status.label
    );
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    const formatted: PageTableColumn[] = [];
    columns.forEach(column => {
      const key = column._column?.key as string;
      if (key === "form_name") {
        column["minWidth"] = 160;
        formatted.push(column);
        // 动态列：按所选表单 schema 展开（未选择表单时不生成）
        schemaFields.value.forEach(field => {
          formatted.push({
            _column: { key: `data.${field.key}` },
            label: field.label || field.key,
            minWidth: 140,
            cellRenderer: ({ row }: { row: RecordType }) =>
              renderFieldCell(field, asRow(row).data?.[field.key])
          } as PageTableColumn);
        });
        return;
      }
      if (key === "status") {
        column["width"] = 120;
        column["cellRenderer"] = ({ row }) => renderStatus(asRow(row));
      }
      if (key === "creator") column["width"] = 120;
      if (key === "created_time" || key === "updated_time")
        column["width"] = 170;
      formatted.push(column);
    });
    return formatted;
  };

  /** 搜索区：表单选择走页面顶部选择器（已注入列表请求），移除搜索区的重复入口 */
  const searchColumnsFormat = (columns: PageTableColumn[]) =>
    columns.filter(column => column._column?.key !== "form");

  return {
    listColumnsFormat,
    searchColumnsFormat
  };
}
