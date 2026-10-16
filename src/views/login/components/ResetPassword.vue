<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { onMounted, ref } from "vue";
import Motion from "../utils/motion";
import type { FormInstance } from "element-plus";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "~icons/ri/lock-fill";
import { resetPasswordApi } from "@/api/auth";
import { handleOperation } from "@/components/RePlusPage";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  createPasswordFormRules
} from "../useLoginFlow";

const { t } = useI18n();
const loading = ref(false);
const configLoading = ref(false);
const formData = ref({
  password: "",
  repeatPassword: "",
  verify_code: "",
  verify_token: undefined
});

const authInfo = ref({
  access: false,
  encrypted: false,
  password: []
});

const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref();

const onBack = backToBasicPage;

const handleSubmit = () => {
  verifyCodeRef.value.getRef().validate((isValid: boolean) => {
    if (isValid) {
      formDataRef.value?.validate(async valid => {
        if (valid) {
          loading.value = true;
          const data = await buildVerifyCodePayload(
            formData.value,
            authInfo.value
          );
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
        }
      });
    }
  });
};

const formRules = createPasswordFormRules({
  t,
  getPasswordRules: () => authInfo.value.password,
  getPassword: () => formData.value.password
});

const configReqSuccess = (verifyCodeConfig: RecordType) => {
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
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
    <el-form
      v-if="authInfo.access"
      ref="formDataRef"
      :model="formData"
      :rules="formRules"
      size="large"
    >
      <div v-if="formData.verify_token">
        <Motion :delay="150">
          <el-form-item prop="password">
            <el-input
              v-model="formData.password"
              :placeholder="t('login.password')"
              :prefix-icon="useRenderIcon(Lock)"
              clearable
              show-password
            />
          </el-form-item>
        </Motion>

        <Motion :delay="200">
          <el-form-item prop="repeatPassword">
            <el-input
              v-model="formData.repeatPassword"
              :placeholder="t('login.sure')"
              :prefix-icon="useRenderIcon(Lock)"
              clearable
              show-password
            />
          </el-form-item>
        </Motion>
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
  </div>
</template>
