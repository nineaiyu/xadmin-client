<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { FormField, FormUserOption } from "@/api/dataset/dform";

/** 选人/级联/选择类控件（自 SubmissionForm 按控件族拆出） */
defineOptions({ name: "SubmissionChoiceField" });

defineProps<{
  field: FormField;
  modelValue: unknown;
  userOptions: FormUserOption[];
  optionEntries: Array<{ label: string; value: string }>;
  dictEmpty: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  searchUsers: [keyword: string];
}>();

const { t } = useI18n();

const cascaderOptions = (field: FormField) =>
  (field.options ?? []).filter(item => typeof item !== "string") as Array<
    Record<string, unknown>
  >;

const userLabel = (user: FormUserOption) =>
  user.nickname ? `${user.username}-${user.nickname}` : user.username;
</script>

<template>
  <el-select
    v-if="field.type === 'user'"
    :model-value="modelValue as string"
    class="w-full"
    :multiple="field.multiple === true"
    filterable
    remote
    reserve-keyword
    clearable
    :remote-method="(keyword: string) => emit('searchUsers', keyword)"
    :placeholder="t('dform.userSearchPlaceholder')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="user in userOptions"
      :key="user.pk"
      :value="user.pk"
      :label="userLabel(user)"
    />
  </el-select>
  <el-cascader
    v-else-if="field.type === 'cascader'"
    :model-value="modelValue as string[]"
    class="w-full"
    :options="cascaderOptions(field)"
    clearable
    @update:model-value="emit('update:modelValue', $event)"
  />
  <el-select
    v-else-if="field.type === 'select'"
    :model-value="modelValue as string"
    class="w-full"
    clearable
    :placeholder="
      dictEmpty ? t('dform.dictEmpty') : t('dform.selectPlaceholder')
    "
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-option
      v-for="option in optionEntries"
      :key="option.value"
      :value="option.value"
      :label="option.label"
    />
  </el-select>
  <el-radio-group
    v-else-if="field.type === 'radio'"
    :model-value="modelValue as string"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-radio
      v-for="option in optionEntries"
      :key="option.value"
      :value="option.value"
      >{{ option.label }}</el-radio
    >
  </el-radio-group>
  <el-checkbox-group
    v-else-if="field.type === 'checkbox'"
    :model-value="modelValue as string[]"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-checkbox
      v-for="option in optionEntries"
      :key="option.value"
      :value="option.value"
      >{{ option.label }}</el-checkbox
    >
  </el-checkbox-group>
</template>
