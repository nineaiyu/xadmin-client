<script lang="ts" setup>
import { computed, ref } from "vue";
import { useSendVerifyCode } from "./hooks";
import Motion from "@/components/ReMotion";
import type { FormInstance } from "element-plus";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReImageVerify from "@/components/ReImageVerify/src/index.vue";
import { ReCaptchaChallenge } from "@/components/ReCaptchaChallenge";
import type { CaptchaMode, CaptchaScene, CaptchaType } from "@/api/auth";
import PhoneInput from "@/components/RePlusPage/src/components/PhoneInput.vue";
import Email from "~icons/ep/message";
import Keyhole from "~icons/ri/shield-keyhole-line";

defineOptions({ name: "ReSendVerifyCode" });

/** 验证码配置（hooks.ts 内 verifyCodeConfig 的响应式形状） */
interface VerifyCodeConfig {
  access: boolean;
  captcha: boolean;
  captcha_mode?: CaptchaMode;
  captcha_types?: CaptchaType[];
  captcha_image_fallback?: boolean;
  token: boolean;
  encrypted: boolean;
  email: boolean;
  sms: boolean;
  rate: number;
}

/** 发送验证码接口返回的 data 载荷（verify_token / extra 由后端按需下发） */
interface SendCodeResultData {
  verify_token?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

const props = withDefaults(defineProps<{ category?: string }>(), {
  category: ""
});

const formData = defineModel({
  type: Object,
  default: () => ({})
});

const emit = defineEmits<{
  configReqSuccess: [config: VerifyCodeConfig];
  sendCodeReqSuccess: [data: SendCodeResultData];
  configReqEnd: [];
}>();
const formDataRef = ref<FormInstance>();
const captchaRef = ref();
const challengeRef = ref<InstanceType<typeof ReCaptchaChallenge>>();

function getRef() {
  return formDataRef.value;
}

const {
  t,
  text,
  access,
  formRules,
  isDisabled,
  verifyCodeConfig,
  interactiveCaptcha,
  configFailed,
  reloadConfig,
  handleSendCode,
  fetchSuggestions
} = useSendVerifyCode(
  formDataRef,
  captchaRef,
  challengeRef,
  formData,
  props,
  emit
);

defineExpose({ getRef, handleSendCode });

const updatePhone = (phone: { code: string; phone: string }) => {
  formData.value.phone = `${phone.code}${phone.phone}`;
};
const phone = ref({ code: "+86", phone: "" });

/** 发码场景与后端 captcha.const 的 scene 枚举同值（category 即场景键） */
const captchaScene = computed<CaptchaScene>(
  () => (props.category || "login") as CaptchaScene
);
</script>

<template>
  <el-result
    v-if="configFailed"
    icon="error"
    :title="t('login.configLoadFailed')"
  >
    <template #extra>
      <el-button type="primary" @click="reloadConfig">
        {{ t("buttons.reload") }}
      </el-button>
    </template>
  </el-result>
  <el-form
    v-else-if="access"
    ref="formDataRef"
    :model="formData"
    :rules="formRules"
    size="large"
  >
    <Motion>
      <el-tabs v-model="formData.form_type" class="w-full">
        <el-tab-pane
          v-if="verifyCodeConfig.sms"
          :label="t('login.smsVerify')"
          name="phone"
        >
          <el-form-item v-if="formData.form_type === 'phone'" prop="phone">
            <PhoneInput
              v-model="phone"
              :disabled="Boolean(formData.verify_token)"
              @change="updatePhone"
            />
          </el-form-item>
        </el-tab-pane>
        <el-tab-pane
          v-if="verifyCodeConfig.email"
          :label="t('login.emailVerify')"
          name="email"
        >
          <el-form-item v-if="formData.form_type === 'email'" prop="email">
            <el-autocomplete
              v-model="formData.email"
              :disabled="Boolean(formData.verify_token)"
              :placeholder="t('login.email')"
              :prefix-icon="useRenderIcon(Email)"
              clearable
              :trigger-on-focus="false"
              :fetch-suggestions="fetchSuggestions"
            />
          </el-form-item>
        </el-tab-pane>
        <slot />
      </el-tabs>
    </Motion>

    <Motion
      v-if="
        verifyCodeConfig.access &&
        verifyCodeConfig.captcha &&
        !interactiveCaptcha
      "
      :delay="200"
    >
      <el-form-item prop="captcha_code">
        <el-input
          v-model="formData.captcha_code"
          :placeholder="t('login.verifyCode')"
          :prefix-icon="useRenderIcon(Keyhole)"
          clearable
        >
          <template #append>
            <ReImageVerify ref="captchaRef" v-model="formData.captcha_key" />
          </template>
        </el-input>
      </el-form-item>
    </Motion>

    <Motion v-if="['email', 'phone'].includes(formData.form_type)" :delay="100">
      <el-form-item prop="verify_code">
        <div class="w-full flex justify-between">
          <el-input
            v-model="formData.verify_code"
            :placeholder="t('login.verifyCode')"
            :prefix-icon="useRenderIcon(Keyhole)"
            clearable
          />
          <el-button
            :disabled="isDisabled"
            class="ml-2"
            @click="handleSendCode(null)"
          >
            {{
              text.length > 0
                ? text + t("login.info")
                : t("login.getVerifyCode")
            }}
          </el-button>
        </div>
      </el-form-item>
    </Motion>
    <ReCaptchaChallenge
      v-if="interactiveCaptcha"
      ref="challengeRef"
      :scene="captchaScene"
      :types="verifyCodeConfig.captcha_types"
      :image-fallback="verifyCodeConfig.captcha_image_fallback === true"
    />
  </el-form>
</template>
