<script setup lang="ts">
import {
  onMounted,
  ref,
  watch,
  nextTick,
  computed,
  getCurrentInstance
} from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useDataPermission } from "./utils/hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { isAllEmpty } from "@pureadmin/utils";
import { match } from "pinyin-pro";
import { useI18n } from "vue-i18n";
import { transformI18n } from "@/plugins/i18n";
import FromQuestion from "@/components/FromQuestion/index.vue";
import Search from "@iconify-icons/ep/search";
import More2Fill from "@iconify-icons/ri/more-2-fill";
import Reset from "@iconify-icons/ri/restart-line";

import filterForm from "./filter/index.vue";

const props = withDefaults(defineProps<FormProps>(), {
  choicesDict: () => [],
  fieldLookupsData: () => [],
  valuesData: () => [],
  formInline: () => ({
    name: "",
    description: "",
    mode_type: "",
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
        clearable
        :placeholder="t('permission.name')"
      />
    </el-form-item>

    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group v-model="newFormInline.is_active">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :label="item.value"
          >{{ item.label }}</el-radio-button
        >
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('permission.mode')" prop="mode_type">
      <el-select
        v-model="newFormInline.mode_type"
        class="filter-item"
        style="width: 180px"
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
        :placeholder="t('labels.verifyDescription')"
        type="textarea"
      />
    </el-form-item>
    <filter-form
      v-model:data-list="newFormInline.rules"
      :rule-list="props.fieldLookupsData"
      :values-data="props.valuesData"
    />
  </el-form>
</template>
