<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import FromQuestion from "@/components/FromQuestion/index.vue";
import ReCol from "@/components/ReCol";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({
    key: "",
    value: "",
    description: "",
    is_active: true,
    inherit: false,
    access: false
  })
});

const { t } = useI18n();
const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

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
    label-width="82px"
  >
    <el-form-item :label="t('configSystem.key')" prop="key">
      <el-input
        v-model="newFormInline.key"
        :disabled="!props.isAdd && props.showColumns.indexOf('key') === -1"
        :placeholder="t('configSystem.key')"
        clearable
      />
    </el-form-item>

    <el-form-item :label="t('configSystem.value')" prop="value">
      <el-input
        v-model="newFormInline.value"
        :autosize="{ minRows: 5, maxRows: 20 }"
        :disabled="!props.isAdd && props.showColumns.indexOf('value') === -1"
        :placeholder="t('configSystem.value')"
        clearable
        type="textarea"
      />
    </el-form-item>
    <el-row :gutter="24">
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('configSystem.access')" prop="access">
          <template #label>
            <from-question
              :description="t('configSystem.accessTip')"
              :label="t('configSystem.access')"
            />
          </template>
          <el-radio-group v-model="newFormInline.access">
            <el-radio-button
              v-for="item in ifEnableOptions"
              :key="item.label"
              :disabled="
                !props.isAdd && props.showColumns.indexOf('access') === -1
              "
              :value="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('configSystem.inherit')" prop="inherit">
          <template #label>
            <from-question
              :description="t('configSystem.inheritTip')"
              :label="t('configSystem.inherit')"
            />
          </template>
          <el-radio-group v-model="newFormInline.inherit">
            <el-radio-button
              v-for="item in ifEnableOptions"
              :key="item.label"
              :disabled="
                !props.isAdd && props.showColumns.indexOf('inherit') === -1
              "
              :value="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group v-model="newFormInline.is_active">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :disabled="
            !props.isAdd && props.showColumns.indexOf('is_active') === -1
          "
          :value="item.value"
          >{{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('labels.description')">
      <el-input
        v-model="newFormInline.description"
        :disabled="
          !props.isAdd && props.showColumns.indexOf('description') === -1
        "
        :placeholder="t('labels.description')"
        type="textarea"
      />
    </el-form-item>
  </el-form>
</template>
