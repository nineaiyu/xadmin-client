import { h } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import CronExpressionField from "../components/CronExpressionField.vue";
import { CRON_FIELD_KEYS, applyCronDraft, cronDraftFromRow } from "./cronDraft";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * crontab 表单：六个原生字段收进一个合成字段 `cron_expression`（结构化编辑器
 * + 未来触发预览），提交前拆回独立字段；原生字段隐藏避免重复录入。
 */
export function buildCronFormColumns({ t }: { t: TFunction }) {
  const hideNative = (column: RecordType) => {
    column.hideInForm = true;
    return column;
  };
  return {
    minute: hideNative,
    hour: hideNative,
    day_of_month: hideNative,
    month_of_year: hideNative,
    day_of_week: hideNative,
    timezone: hideNative,
    cron_expression: ({ column }: { column: RecordType }) => {
      column.label = t("systemTaskCrontab.expression");
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(CronExpressionField, {
          modelValue: (value as RecordType | undefined) ?? null,
          "onUpdate:modelValue": onChange
        });
      return column;
    }
  };
}

export function createCronFormOptions({ t }: { t: TFunction }) {
  return {
    props: {
      row: {
        cron_expression: ({ rawRow }: { rawRow?: RecordType }) =>
          cronDraftFromRow(rawRow)
      },
      columns: buildCronFormColumns({ t }),
      beforeSubmit: ({ formData }: { formData: RecordType }) =>
        formData.cron_expression
          ? applyCronDraft(formData, formData.cron_expression)
          : formData
    }
  };
}

/** 是否包含全部 cron 字段（用于界面提示与测试） */
export const hasAllCronFields = (value: RecordType) =>
  CRON_FIELD_KEYS.every(key => String(value[key] ?? "").trim().length > 0);
