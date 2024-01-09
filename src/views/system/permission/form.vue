<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";

import filterForm from "./filter/index.vue";
import { ModeChoices } from "@/views/system/constants";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  choicesDict: () => [],
  fieldLookupsData: () => [],
  valuesData: () => [],
  formInline: () => ({
    name: "",
    description: "",
    mode_type: ModeChoices.OR,
    rules: [],
    is_active: true
  })
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const { t } = useI18n();
const ifEnableOptions = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="100px"
  >
    <el-form-item :label="t('permission.name')" prop="name">
      <el-input
        v-model="newFormInline.name"
        :disabled="!props.isAdd && props.showColumns.indexOf('name') === -1"
        clearable
        :placeholder="t('permission.name')"
      />
    </el-form-item>

    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group
        v-model="newFormInline.is_active"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('is_active') === -1
        "
      >
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :label="item.value"
          >{{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('permission.mode')" prop="mode_type">
      <el-select
        v-model="newFormInline.mode_type"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('mode_type') === -1
        "
        class="!w-[180px]"
        clearable
      >
        <el-option
          v-for="item in props.choicesDict"
          :key="item.key"
          :label="item.label"
          :disabled="item.disabled"
          :value="item.key"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('labels.description')">
      <el-input
        v-model="newFormInline.description"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('description') === -1
        "
        :placeholder="t('labels.verifyDescription')"
        type="textarea"
      />
    </el-form-item>
    <filter-form
      v-model:data-list="newFormInline.rules"
      :disabled="!props.isAdd && props.showColumns.indexOf('rules') === -1"
      :rule-list="props.fieldLookupsData"
      :values-data="props.valuesData"
    />
  </el-form>
</template>
