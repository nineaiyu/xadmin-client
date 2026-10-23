<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { onMounted, ref } from "vue";
import Motion from "../utils/motion";
import type { FormInstance } from "element-plus";
import { resetPasswordApi } from "@/api/auth";
import { handleOperation } from "@/components/RePlusPage";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import PasswordFields from "./PasswordFields.vue";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  createPasswordFormRules,
  useAuthInfo,
  useVerifyCodeSubmit
} from "../useLoginFlow";

const { t } = useI18n();
const loading = ref(false);
const { authInfo, configLoading, onConfig } = useAuthInfo();
const formData = ref({
  password: "",
  repeatPassword: "",
  verify_code: "",
  verify_token: undefined as string | undefined
});

const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref<{
  getRef?: () => FormInstance;
}>();

const onBack = backToBasicPage;

const onSubmit = async () => {
  loading.value = true;
  const data = await buildVerifyCodePayload(formData.value, authInfo.value);
  handleOperation({
    t,
    apiReq: resetPasswordApi(data),
    success() {
      // 重置密码不登录：成功即返回账号密码登录页
      onBack();
    },
    requestEnd() {
      loading.value = false;
    }
  });
};

// 共享提交链（含 ref 空值保护）：验证码表单 → 本表单 → 提交
const handleSubmit = useVerifyCodeSubmit({
  verifyRef: verifyCodeRef,
  formRef: formDataRef,
  onSubmit
});

const formRules = createPasswordFormRules({
  t,
  getPasswordRules: () => authInfo.value.password ?? [],
  getPassword: () => formData.value.password
});

const configReqSuccess = (verifyCodeConfig: RecordType) => {
  onConfig(verifyCodeConfig);
};
onMounted(() => (configLoading.value = true));
</script>

<template>
  <div v-loading="configLoading">
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      category="reset"
      @configReqSuccess="configReqSuccess"
      @configReqEnd="configLoading = false"
    />
    <!-- 未开放自助重置：保留可读说明与返回入口，不渲染空白页 -->
    <el-form
      v-if="authInfo.access"
      ref="formDataRef"
      :model="formData"
      :rules="formRules"
      size="large"
    >
      <div v-if="formData.verify_token">
        <PasswordFields
          v-model:password="formData.password"
          v-model:repeat-password="formData.repeatPassword"
          :password-delay="150"
          :repeat-delay="200"
        />
        <Motion :delay="250">
          <el-form-item>
            <el-button
              :loading="loading"
              class="w-full"
              size="default"
              type="primary"
              @click="handleSubmit"
            >
              {{ t("login.definite") }}
            </el-button>
          </el-form-item>
        </Motion>
      </div>
      <Motion :delay="300">
        <el-form-item>
          <el-button class="w-full" size="default" @click="onBack">
            {{ t("login.back") }}
          </el-button>
        </el-form-item>
      </Motion>
    </el-form>
    <el-result v-else icon="info" :title="t('login.resetUnavailable')">
      <template #extra>
        <el-button size="default" @click="onBack">
          {{ t("login.back") }}
        </el-button>
      </template>
    </el-result>
  </div>
</template>
