<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { usePublicHooks } from "../../hooks";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  formInline: () => ({
    is_add: true,
    name: "",
    code: "",
    parent: "",
    rank: 99,
    roles: [],
    description: "",
    is_active: true
  })
});
const { t } = useI18n();

const ruleFormRef = ref();
const { switchStyle } = usePublicHooks();
const newFormInline = ref(props.formInline);

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
    label-width="82px"
  >
    <el-row :gutter="30">
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('dept.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('dept.name')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('dept.code')" prop="code">
          <el-input
            v-model="newFormInline.code"
            clearable
            :placeholder="t('dept.code')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('menu.parentNode')" prop="parent">
          <el-cascader
            v-model="newFormInline.parent"
            class="w-full"
            :options="props.treeData"
            :props="{
              value: 'pk',
              label: 'name',
              emitPath: false,
              checkStrictly: true
            }"
            clearable
            filterable
            :placeholder="t('menu.parentNode')"
          >
            <template #default="{ node, data }">
              <span>{{ data.name }}</span>
              <span v-if="!node.isLeaf"> ({{ data.children.length }}) </span>
            </template>
          </el-cascader>
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('dept.rank')" prop="rank">
          <el-input
            v-model="newFormInline.rank"
            clearable
            type="number"
            :placeholder="t('dept.rank')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-switch
            v-model="newFormInline.is_active"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            :active-text="t('labels.active')"
            :inactive-text="t('labels.inactive')"
            :style="switchStyle"
          />
        </el-form-item>
      </re-col>

      <re-col>
        <el-form-item :label="t('labels.description')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.verifyDescription')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
