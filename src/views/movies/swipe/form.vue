<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import ReCol from "@/components/ReCol";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    name: "",
    rank: "",
    description: "",
    route: "",
    enable: true
  }),
  categoryData: () => []
});

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);
function getRef() {
  return ruleFormRef.value;
}

const { t } = useI18n();

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="140px"
  >
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesSwipe.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('MoviesSwipe.name')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesSwipe.route')" prop="route">
          <el-input
            v-model="newFormInline.route"
            clearable
            :placeholder="t('MoviesSwipe.route')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesSwipe.rank')" prop="rank">
          <el-input
            v-model="newFormInline.rank"
            clearable
            type="number"
            :placeholder="t('MoviesSwipe.rank')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="enable">
          <el-switch
            v-model="newFormInline.enable"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            :active-text="t('labels.enable')"
            :inactive-text="t('labels.disable')"
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.remark')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.remark')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
