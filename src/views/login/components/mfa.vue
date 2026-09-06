<script lang="ts" setup>
/**
 * 登录 MFA 二次验证步骤：密码阶段通过后（mfa_required），
 * 选择验证方式 → 挑战码发送 → 动态码校验，通过后由父组件完成登录跳转。
 */
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { LoginMfaRequired } from "@/api/mfa";
import { loginMfaSendCodeApi, loginMfaVerifyApi } from "@/api/mfa";
import type { TokenInfo } from "@/api/auth";
import Shield from "~icons/ri/shield-keyhole-line";

defineOptions({
  name: "LoginMfa"
});

const props = defineProps<{
  /** 密码登录返回的 mfa_required 载荷（mfa_token + 可用方式） */
  mfaInfo: LoginMfaRequired;
}>();

const emit = defineEmits<{
  /** 验证通过，载荷即正式 TokenInfo */
  success: [data: TokenInfo];
  /** 返回重新登录 */
  back: [];
}>();

const { t } = useI18n();
const loading = ref(false);
const sendCooldown = ref(0);
const code = ref("");
const currentMethod = ref(props.mfaInfo.methods[0]?.name ?? "");
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const activeMethod = computed(() =>
  props.mfaInfo.methods.find(item => item.name === currentMethod.value)
);

const startCooldown = () => {
  sendCooldown.value = 60;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    sendCooldown.value -= 1;
    if (sendCooldown.value <= 0) {
      clearInterval(cooldownTimer!);
      cooldownTimer = null;
    }
  }, 1000);
};

const handleSendCode = () => {
  loginMfaSendCodeApi({
    mfa_token: props.mfaInfo.mfa_token,
    method: currentMethod.value
  }).then(res => {
    if (res.code === 1000) {
      message(res.detail || t("mfa.codeSent"), { type: "success" });
      startCooldown();
    } else {
      message(res.detail, { type: "warning" });
    }
  });
};

const handleVerify = () => {
  if (!code.value) {
    message(t("mfa.codeRequired"), { type: "warning" });
    return;
  }
  loading.value = true;
  loginMfaVerifyApi({
    mfa_token: props.mfaInfo.mfa_token,
    method: currentMethod.value,
    code: code.value
  })
    .then(res => {
      if (res.code === 1000) {
        emit("success", res.data);
      } else {
        message(res.detail, { type: "warning" });
      }
    })
    .catch(() => {
      // 验证失败（412 等已由 http 层提示），停留在本页可重试
    })
    .finally(() => {
      loading.value = false;
    });
};

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>

<template>
  <el-form size="large">
    <Motion :delay="100">
      <el-form-item>
        <el-alert
          :title="$t('mfa.loginVerifyTip')"
          type="info"
          :closable="false"
          show-icon
          class="w-full"
        />
      </el-form-item>
    </Motion>
    <Motion :delay="150">
      <el-form-item>
        <el-radio-group v-model="currentMethod" class="w-full flex-col!">
          <el-radio
            v-for="item in mfaInfo.methods"
            :key="item.name"
            :value="item.name"
            class="w-full"
          >
            {{ item.display_name }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </Motion>
    <Motion v-if="activeMethod?.challenge_required" :delay="200">
      <el-form-item>
        <el-button
          type="primary"
          link
          :disabled="sendCooldown > 0"
          @click="handleSendCode"
        >
          {{
            sendCooldown > 0
              ? $t("mfa.resendAfter", { seconds: sendCooldown })
              : $t("mfa.sendCode")
          }}
        </el-button>
      </el-form-item>
    </Motion>
    <Motion :delay="250">
      <el-form-item>
        <el-input
          v-model="code"
          :placeholder="activeMethod?.placeholder ?? $t('mfa.codePlaceholder')"
          :prefix-icon="useRenderIcon(Shield)"
          clearable
          @keyup.enter="handleVerify"
        />
      </el-form-item>
    </Motion>
    <Motion :delay="300">
      <el-form-item>
        <el-button
          :loading="loading"
          class="w-full!"
          size="default"
          type="primary"
          @click="handleVerify"
        >
          {{ $t("mfa.loginVerify") }}
        </el-button>
      </el-form-item>
    </Motion>
    <Motion :delay="350">
      <el-form-item>
        <el-button class="w-full!" size="default" @click="emit('back')">
          {{ $t("mfa.backToLogin") }}
        </el-button>
      </el-form-item>
    </Motion>
  </el-form>
</template>
