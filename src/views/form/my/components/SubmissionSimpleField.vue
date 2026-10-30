<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import UploadFiles from "@/components/RePlusPage/src/components/UploadFiles.vue";
import type { FormField } from "@/api/dataset/dform";

/** 文本/数字/日期/公式/开关/附件等基础控件（自 SubmissionForm 按控件族拆出） */
defineOptions({ name: "SubmissionSimpleField" });

defineProps<{
  field: FormField;
  modelValue: unknown;
  formulaText: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const { t } = useI18n();
</script>

<template>
  <el-input
    v-if="field.type === 'input'"
    :model-value="modelValue as string"
    :maxlength="field.max_length"
    :placeholder="field.placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-input
    v-else-if="field.type === 'textarea'"
    :model-value="modelValue as string"
    type="textarea"
    :rows="3"
    :maxlength="field.max_length"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-input-number
    v-else-if="field.type === 'number'"
    :model-value="modelValue as number"
    :min="field.min"
    :max="field.max"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-input-number
    v-else-if="field.type === 'amount'"
    :model-value="modelValue as number"
    :min="field.min"
    :max="field.max"
    :precision="field.precision"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <div
    v-else-if="field.type === 'formula'"
    class="font-medium text-(--el-text-color-primary)"
    data-testid="dform-formula-value"
  >
    {{ formulaText || "—" }}
  </div>
  <el-date-picker
    v-else-if="field.type === 'date'"
    :model-value="modelValue as string"
    type="date"
    value-format="YYYY-MM-DD"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-date-picker
    v-else-if="field.type === 'daterange'"
    :model-value="modelValue as string[]"
    type="daterange"
    value-format="YYYY-MM-DD"
    :start-placeholder="t('dform.rangeStart')"
    :end-placeholder="t('dform.rangeEnd')"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <UploadFiles
    v-else-if="field.type === 'upload'"
    :model-value="modelValue as Record<string, unknown>[]"
    multiple
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-switch
    v-else-if="field.type === 'switch'"
    :model-value="modelValue as boolean"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
