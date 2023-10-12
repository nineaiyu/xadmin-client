<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { usePublicHooks } from "../../hooks";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    is_add: true,
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    sex: 0,
    roles: [],
    password: "",
    is_active: true
  })
});
const { t } = useI18n();

const sexOptions = [
  { label: t("user.male"), value: 0 },
  { label: t("user.female"), value: 1 },
  { label: t("user.unknown"), value: 2 }
];
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
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="newFormInline.username"
            clearable
            :placeholder="t('user.verifyUsername')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.nickname')" prop="nickname">
          <el-input
            v-model="newFormInline.nickname"
            clearable
            :placeholder="t('user.verifyNickname')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24" v-if="newFormInline.is_add">
        <el-form-item :label="t('user.password')" prop="password">
          <el-input
            v-model="newFormInline.password"
            clearable
            :placeholder="t('user.verifyPassword')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="newFormInline.mobile"
            clearable
            :placeholder="t('user.verifyMobile')"
          />
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.email')" prop="email">
          <el-input
            v-model="newFormInline.email"
            clearable
            :placeholder="t('user.verifyEmail')"
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
        <el-form-item :label="t('labels.remark')">
          <el-input
            v-model="newFormInline.remark"
            :placeholder="t('labels.verifyRemark')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
