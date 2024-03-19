<script lang="ts" setup>
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { usePublicHooks } from "@/views/system/hooks";
import { useI18n } from "vue-i18n";
import FromQuestion from "@/components/FromQuestion/index.vue";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  treeData: () => [],
  showColumns: () => [],
  formInline: () => ({
    name: "",
    code: "",
    parent: "",
    rank: 99,
    roles: [],
    description: "",
    is_active: true,
    auto_bind: true
  })
});
const { t } = useI18n();

const ruleFormRef = ref();
const { switchStyle } = usePublicHooks();
const newFormInline = ref(props.formInline);
const ifEnableOptions = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="100px"
  >
    <el-row :gutter="30">
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('dept.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            :disabled="!props.isAdd && props.showColumns.indexOf('name') === -1"
            :placeholder="t('dept.name')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('dept.code')" prop="code">
          <el-input
            v-model="newFormInline.code"
            :disabled="!props.isAdd && props.showColumns.indexOf('code') === -1"
            :placeholder="t('dept.code')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('menu.parentNode')" prop="parent">
          <el-cascader
            v-model="newFormInline.parent"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('parent') === -1
            "
            :options="props.treeData"
            :placeholder="t('menu.parentNode')"
            :props="{
              value: 'pk',
              label: 'name',
              emitPath: false,
              checkStrictly: true
            }"
            class="w-full"
            clearable
            filterable
          >
            <template #default="{ node, data }">
              <span>{{ data.name }}</span>
              <span v-if="!node.isLeaf"> ({{ data.children.length }}) </span>
            </template>
          </el-cascader>
        </el-form-item>
      </re-col>

      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('sorts.rank')" prop="rank">
          <el-input
            v-model="newFormInline.rank"
            :disabled="!props.isAdd && props.showColumns.indexOf('rank') === -1"
            :placeholder="t('sorts.rank')"
            clearable
            type="number"
          />
        </el-form-item>
      </re-col>

      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('dept.autoBind')" prop="auto_bind">
          <template #label>
            <from-question
              :description="t('dept.autoBindDesc')"
              :label="t('dept.autoBind')"
            />
          </template>
          <el-radio-group v-model="newFormInline.auto_bind">
            <el-radio-button
              v-for="item in ifEnableOptions"
              :key="item.label"
              :disabled="
                !props.isAdd && props.showColumns.indexOf('auto_bind') === -1
              "
              :value="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-switch
            v-model="newFormInline.is_active"
            :active-text="t('labels.active')"
            :active-value="true"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('is_active') === -1
            "
            :inactive-text="t('labels.inactive')"
            :inactive-value="false"
            :style="switchStyle"
            inline-prompt
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.description')">
          <el-input
            v-model="newFormInline.description"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('description') === -1
            "
            :placeholder="t('labels.verifyDescription')"
            rows="3"
            type="textarea"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
