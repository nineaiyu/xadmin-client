<script lang="ts" setup>
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Iphone from "@iconify-icons/ep/iphone";
import Email from "@iconify-icons/ep/message";
import { computed, reactive, ref, useSlots } from "vue";
import type { FormInstance } from "element-plus";
import Motion from "@/views/login/utils/motion";
import ReImageVerify from "@/components/ReImageVerify/src/index.vue";
import { useSendVerifyCode } from "./hooks";

defineOptions({ name: "ReSendVerifyCode" });

interface SendVerifyProps {
  category: string;
}

const props = withDefaults(defineProps<SendVerifyProps>(), {
  category: ""
});

const formData = defineModel({
  type: Object,
  default: {}
});

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();
const formDataRef = ref<FormInstance>();

function getRef() {
  return formDataRef.value;
}

const { t, text, formRules, isDisabled, verifyCodeConfig, handleSendCode } =
  useSendVerifyCode(formDataRef, formData, props, emit);

const $slots = useSlots();
defineExpose({ getRef, handleSendCode });

const access = computed(
  () =>
    verifyCodeConfig.access &&
    (verifyCodeConfig.sms || verifyCodeConfig.email || $slots.default)
);
</script>

<template>
  <el-form
    v-if="access"
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
            <el-input
              v-model="formData.phone"
              :disabled="Boolean(formData.verify_token)"
              :placeholder="t('login.phone')"
              :prefix-icon="useRenderIcon(Iphone)"
              clearable
            />
          </el-form-item>
        </el-tab-pane>
        <el-tab-pane
          v-if="verifyCodeConfig.email"
          :label="t('login.emailVerify')"
          name="email"
        >
          <el-form-item v-if="formData.form_type === 'email'" prop="email">
            <el-input
              v-model="formData.email"
              :disabled="Boolean(formData.verify_token)"
              :placeholder="t('login.email')"
              :prefix-icon="useRenderIcon(Email)"
              clearable
            />
          </el-form-item>
        </el-tab-pane>
        <slot />
      </el-tabs>
    </Motion>

    <Motion
      v-if="verifyCodeConfig.access && verifyCodeConfig.captcha"
      :delay="200"
    >
      <el-form-item prop="captcha_code">
        <el-input
          v-model="formData.captcha_code"
          :placeholder="t('login.verifyCode')"
          :prefix-icon="useRenderIcon('ri:shield-keyhole-line')"
          clearable
        >
          <template #append>
            <ReImageVerify v-model="formData.captcha_key" />
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
            :prefix-icon="useRenderIcon('ri:shield-keyhole-line')"
            clearable
          />
          <el-button
            :disabled="isDisabled"
            class="ml-2"
            @click="handleSendCode"
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
  </el-form>
</template>
