import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 起止日期 → 含首尾的自然日天数；日期不完整时不改动用户手填值 */
function syncDays(formValue?: { value?: Record<string, unknown> }) {
  const start = Date.parse(String(formValue?.value?.start_date ?? ""));
  const end = Date.parse(String(formValue?.value?.end_date ?? ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
  if (!formValue?.value) return;
  formValue.value.days = Math.max(0.5, (end - start) / 86400000 + 1);
}

/** 请假表单列：事由多行、天数半天步进、起止日期联动天数 */
export function buildLeaveFormColumns(_t: TFunction) {
  return {
    reason: ({ column }: { column: Record<string, unknown> }) => {
      column.valueType = "textarea";
      column["fieldProps"] = {
        ...((column["fieldProps"] as object) ?? {}),
        autosize: { minRows: 3 }
      };
      return column;
    },
    days: ({ column }: { column: Record<string, unknown> }) => {
      column.valueType = "input-number";
      column["fieldProps"] = {
        ...((column["fieldProps"] as object) ?? {}),
        min: 0.5,
        step: 0.5,
        precision: 1
      };
      return column;
    },
    start_date: ({
      column,
      formValue
    }: {
      column: Record<string, unknown>;
      formValue?: { value?: Record<string, unknown> };
    }) => {
      column.fieldProps = {
        ...((column["fieldProps"] as object) ?? {}),
        valueFormat: "YYYY-MM-DD",
        onChange: () => syncDays(formValue)
      };
      return column;
    },
    end_date: ({
      column,
      formValue
    }: {
      column: Record<string, unknown>;
      formValue?: { value?: Record<string, unknown> };
    }) => {
      column.fieldProps = {
        ...((column["fieldProps"] as object) ?? {}),
        valueFormat: "YYYY-MM-DD",
        onChange: () => syncDays(formValue)
      };
      return column;
    }
  };
}
