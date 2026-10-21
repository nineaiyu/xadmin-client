<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { message } from "@/utils/message";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { onMounted, ref } from "vue";
import type { FormInstance } from "element-plus";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import PasswordFields from "./PasswordFields.vue";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  createPasswordFormRules,
  useAuthInfo,
  useLoginFlow,
  useVerifyCodeSubmit
} from "../useLoginFlow";

const { t } = useI18n();
const checked = ref(false);
/** 隐私政策弹窗：无独立路由，注册页内以对话框展示简要条款 */
const privacyVisible = ref(false);
const { authInfo, configLoading, onConfig } = useAuthInfo();
const formData = ref({
  password: "",
  repeatPassword: "",
  form_type: "",
  verify_code: "",
  verify_token: undefined as string | undefined
});
const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref<{
  getRef?: () => FormInstance;
}>();

const { loading, handleLoginSuccess } = useLoginFlow();

const onRegister = async () => {
  loading.value = true;
  const data = await buildVerifyCodePayload(formData.value, authInfo.value);
  useUserStoreHook()
    .registerByUsername(data)
    .then(() => {
      // 注册成功走统一登录流：成功提示、动态路由与 redirect 跳转、loading 收口
      handleLoginSuccess("register");
    })
    .catch(err => {
      loading.value = false;
      message(err.detail, {
        type: "warning"
      });
    });
};

const onBack = backToBasicPage;

const formRules = createPasswordFormRules({
  t,
  getPasswordRules: () => authInfo.value.password ?? [],
  getPassword: () => formData.value.password
});

const configReqSuccess = (verifyCodeConfig: RecordType) => {
  onConfig(verifyCodeConfig);
};

// 隐私勾选是提交前置（非表单校验）：勾选通过才提交，否则提示
const handleRegister = useVerifyCodeSubmit({
  verifyRef: verifyCodeRef,
  formRef: formDataRef,
  onSubmit: async () => {
    if (checked.value) {
      await onRegister();
    } else {
      message(transformI18n($t("login.tickPrivacy")), {
        type: "warning"
      });
    }
  }
});

onMounted(() => (configLoading.value = true));
</script>

<template>
  <div v-loading="configLoading">
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      category="register"
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
      <PasswordFields
        v-if="formData.verify_token"
        v-model:password="formData.password"
        v-model:repeat-password="formData.repeatPassword"
        :rules="formRules"
        :password-delay="200"
        :repeat-delay="250"
      />
      <Motion :delay="300">
        <el-form-item>
          <el-checkbox v-model="checked">
            {{ t("login.readAccept") }}
          </el-checkbox>
          <el-button link type="primary" @click="privacyVisible = true">
            {{ t("login.privacyPolicy") }}
          </el-button>
        </el-form-item>
      </Motion>

      <Motion :delay="350">
        <el-form-item>
          <el-button
            :loading="loading"
            class="w-full"
            size="default"
            type="primary"
            @click="handleRegister"
          >
            {{ t("login.definite") }}
          </el-button>
        </el-form-item>
      </Motion>
    </el-form>
    <Motion v-else :delay="300">
      <el-result icon="error" :title="t('login.serverRegisterForbidden')" />
    </Motion>
    <Motion :delay="400">
      <el-form-item>
        <el-button class="w-full" size="default" @click="onBack">
          {{ t("login.back") }}
        </el-button>
      </el-form-item>
    </Motion>

    <el-dialog
      v-model="privacyVisible"
      :title="t('login.privacyPolicy')"
      width="480px"
      append-to-body
    >
      <p class="text-sm/6 text-(--el-text-color-regular)">
        {{ t("login.privacyPolicyBody") }}
      </p>
      <template #footer>
        <el-button type="primary" @click="privacyVisible = false">
          {{ t("login.definite") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
