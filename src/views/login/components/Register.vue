<script lang="ts" setup>
import OverlayDialog from "@/components/overlay/OverlayDialog.vue";
import { useI18n } from "vue-i18n";
import Motion from "@/components/ReMotion";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { computed, onMounted, ref } from "vue";
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
/** 注册入口可用性:能力清单下发(关闭时不渲染注册表单) */
const registerEnabled = computed(
  () => useLoginPageStoreHook().capabilities?.register?.enabled === true
);
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
  let data: Record<string, string | undefined>;
  try {
    data = await buildVerifyCodePayload(formData.value, authInfo.value);
  } catch {
    loading.value = false;
    message(t("login.registerFailed"), { type: "error" });
    return;
  }
  // 注册失败是 200 信封里的业务码（账号已存在 / 密码不合规 / 注册关闭）：
  // 必须显式分流，否则会先提示「注册成功」再跳转，用户既看不到失败原因也无法重试。
  try {
    const res = await useUserStoreHook().registerByUsername(data);
    if (!isSuccess(res)) {
      loading.value = false;
      message(String(res?.detail ?? t("login.registerFailed")), {
        type: "warning"
      });
      return;
    }
    // 注册成功走统一登录流：成功提示、动态路由与 redirect 跳转、loading 收口
    handleLoginSuccess("register");
  } catch (err) {
    loading.value = false;
    const detail = (err as { detail?: unknown } | null)?.detail;
    message(String(detail ?? t("login.registerFailed")), { type: "warning" });
  }
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
      v-if="registerEnabled"
      ref="formDataRef"
      :model="formData"
      :rules="formRules"
      size="large"
    >
      <PasswordFields
        v-if="formData.verify_token"
        v-model:password="formData.password"
        v-model:repeat-password="formData.repeatPassword"
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
            data-testid="register-submit"
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

    <OverlayDialog
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
    </OverlayDialog>
  </div>
</template>
