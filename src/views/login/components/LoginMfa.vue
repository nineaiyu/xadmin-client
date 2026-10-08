<script lang="ts" setup>
/**
 * 登录 MFA 二次验证步骤：密码阶段通过后（mfa_required），
 * 选择验证方式 → 挑战码发送 → 动态码校验，通过后由父组件完成登录跳转。
 * 交互逻辑（方式选择 / 发码冷却 / 动态码与 Passkey 提交）收敛在
 * `useMfaVerify`，与敏感操作确认弹窗共用同一份实现。
 */
import { computed } from "vue";
import Motion from "../utils/motion";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { LoginMfaRequired } from "@/api/mfa";
import { loginMfaSendCodeApi, loginMfaVerifyApi } from "@/api/mfa";
import type { TokenInfo } from "@/api/auth";
import { passkeyApi } from "@/api/system/security";
import { useMfaVerify } from "@/hooks/useMfaVerify";
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

const methods = computed(() => props.mfaInfo.methods);

const {
  loading,
  code,
  currentMethod,
  activeMethod,
  isPasskey,
  sendCooldown,
  handleSendCode,
  handleVerify
} = useMfaVerify({
  methods,
  sendCode: method =>
    loginMfaSendCodeApi({ mfa_token: props.mfaInfo.mfa_token, method }),
  verify: (method, value) =>
    loginMfaVerifyApi({
      mfa_token: props.mfaInfo.mfa_token,
      method,
      code: value
    }),
  passkeyChallenge: () => passkeyApi.loginChallenge(props.mfaInfo.mfa_token),
  onSuccess: res => emit("success", res.data)
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
    <Motion v-if="isPasskey" :delay="230">
      <el-form-item>
        <el-alert
          :title="$t('passkey.loginTip')"
          type="info"
          :closable="false"
          show-icon
          class="w-full"
        />
      </el-form-item>
    </Motion>
    <Motion v-if="!isPasskey" :delay="250">
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
          {{ isPasskey ? $t("passkey.login") : $t("mfa.loginVerify") }}
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
