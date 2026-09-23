<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

/**
 * 批量更新内容组件（F-1）：选择字段 + 值，交由父级 addDialog 提交。
 *
 * 字段白名单由页面声明（避免把关联/上传类字段暴露给批量写入），
 * `getFields()` 返回 `{ [field]: value }`，未选字段或空值返回 null（父级拦截提交）。
 */
type BatchFieldOption = {
  key: string;
  label: string;
  input_type?: "boolean" | "number" | "text";
  choices?: Array<{ value: string | number | boolean; label: string }>;
};

const props = withDefaults(defineProps<{ fields?: BatchFieldOption[] }>(), {
  fields: () => []
});
const { t } = useI18n();

const fieldKey = ref("");
const boolValue = ref(false);
const numValue = ref(0);
const textValue = ref("");
const choiceValue = ref<string | number | boolean | null>(null);

const activeField = computed(() =>
  props.fields.find(item => item.key === fieldKey.value)
);
const choiceOptions = computed(() => activeField.value?.choices ?? []);

function onFieldChange() {
  boolValue.value = false;
  numValue.value = 0;
  textValue.value = "";
  choiceValue.value = null;
}

function getFields(): Record<string, unknown> | null {
  const field = activeField.value;
  if (!field) return null;
  let value: unknown;
  if (field.input_type === "boolean") {
    value = boolValue.value;
  } else if (field.input_type === "number") {
    value = numValue.value;
  } else if (choiceOptions.value.length) {
    value = choiceValue.value;
  } else {
    value = textValue.value.trim();
    if (!value) return null;
  }
  if (value === null || value === undefined) return null;
  return { [field.key]: value };
}

defineExpose({ getFields });
</script>

<template>
  <el-form label-width="90px" @submit.prevent>
    <el-form-item :label="t('batchUpdate.field')" required>
      <el-select
        v-model="fieldKey"
        filterable
        class="w-full"
        :placeholder="t('batchUpdate.fieldPlaceholder')"
        @change="onFieldChange"
      >
        <el-option
          v-for="item in fields"
          :key="item.key"
          :label="item.label"
          :value="item.key"
        />
      </el-select>
    </el-form-item>
    <el-form-item v-if="activeField" :label="t('batchUpdate.value')" required>
      <el-switch
        v-if="activeField.input_type === 'boolean'"
        v-model="boolValue"
      />
      <el-input-number
        v-else-if="activeField.input_type === 'number'"
        v-model="numValue"
        class="w-full"
      />
      <el-select
        v-else-if="choiceOptions.length"
        v-model="choiceValue"
        clearable
        class="w-full"
      >
        <el-option
          v-for="item in choiceOptions"
          :key="String(item.value)"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-input
        v-else
        v-model="textValue"
        :placeholder="t('batchUpdate.valuePlaceholder')"
      />
    </el-form-item>
    <el-alert
      v-if="activeField"
      type="warning"
      :closable="false"
      show-icon
      :title="t('batchUpdate.tip')"
    />
  </el-form>
</template>
