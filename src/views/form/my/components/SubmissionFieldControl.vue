<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { FormField, FormUserOption } from "@/api/dataset/dform";
import SubmissionSimpleField from "./SubmissionSimpleField.vue";
import SubmissionChoiceField from "./SubmissionChoiceField.vue";
import SubmissionTableField from "./SubmissionTableField.vue";

/**
 * 动态表单控件分发（按控件族）：简单控件 / 选择类 / 明细子表各成文件，
 * 未知类型显式提示（不静默渲染空白）。
 */
defineOptions({ name: "SubmissionFieldControl" });

defineProps<{
  field: FormField;
  modelValue: unknown;
  formulaText: string;
  userOptions: FormUserOption[];
  optionEntries: Array<{ label: string; value: string }>;
  dictEmpty: boolean;
  rows: Record<string, unknown>[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  searchUsers: [keyword: string];
  addRow: [];
  removeRow: [index: number];
}>();

const { t } = useI18n();

const SIMPLE_TYPES = new Set([
  "input",
  "textarea",
  "number",
  "amount",
  "formula",
  "date",
  "daterange",
  "upload",
  "switch"
]);
const CHOICE_TYPES = new Set([
  "user",
  "cascader",
  "select",
  "radio",
  "checkbox"
]);

const kindOf = (type: string) => {
  if (SIMPLE_TYPES.has(type)) return "simple";
  if (CHOICE_TYPES.has(type)) return "choice";
  if (type === "table") return "table";
  return "unknown";
};
</script>

<template>
  <SubmissionSimpleField
    v-if="kindOf(field.type) === 'simple'"
    :field="field"
    :model-value="modelValue"
    :formula-text="formulaText"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <SubmissionChoiceField
    v-else-if="kindOf(field.type) === 'choice'"
    :field="field"
    :model-value="modelValue"
    :user-options="userOptions"
    :option-entries="optionEntries"
    :dict-empty="dictEmpty"
    @update:model-value="emit('update:modelValue', $event)"
    @search-users="emit('searchUsers', $event)"
  />
  <SubmissionTableField
    v-else-if="kindOf(field.type) === 'table'"
    :field="field"
    :rows="rows"
    @add-row="emit('addRow')"
    @remove-row="emit('removeRow', $event)"
  />
  <span v-else class="text-(--el-color-danger)">
    {{ t("dform.unsupportedFieldType", { type: field.type }) }}
  </span>
</template>
