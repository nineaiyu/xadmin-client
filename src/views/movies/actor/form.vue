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
    foreign_name: "",
    sex: "",
    birthday: "",
    introduction: "",
    description: "",
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

const sexOptions = [
  { label: t("user.male"), value: 0 },
  { label: t("user.female"), value: 1 },
  { label: t("user.unknown"), value: 2 }
];

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
        <el-form-item :label="t('MoviesActor.name')" prop="name">
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('MoviesActor.name')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesActor.foreignName')" prop="foreign_name">
          <el-input
            v-model="newFormInline.foreign_name"
            clearable
            :placeholder="t('MoviesActor.foreignName')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.gender')" prop="sex">
          <el-select v-model="newFormInline.sex" class="w-full" clearable>
            <el-option
              v-for="item in sexOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesActor.birthday')" prop="birthday">
          <el-date-picker
            v-model="newFormInline.birthday"
            type="date"
            :placeholder="t('MoviesActor.birthday')"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item
          :label="t('MoviesActor.introduction')"
          prop="introduction"
        >
          <el-input
            v-model="newFormInline.introduction"
            :placeholder="t('MoviesActor.introduction')"
            type="textarea"
            rows="5"
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
