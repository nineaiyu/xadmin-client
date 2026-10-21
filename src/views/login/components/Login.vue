<script lang="ts" setup>
import OAuthEntry from "./OauthEntry.vue";
import RememberLogin from "./RememberLogin.vue";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { LOGIN_PAGE } from "../utils/enums";
import {
  loginVerifyCodeApi,
  type LoginResultData,
  type TokenInfo
} from "@/api/auth";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { handleOperation } from "@/components/RePlusPage";
import LoginMfa from "./LoginMfa.vue";
import type { FormInstance } from "element-plus";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  useAuthInfo,
  useEnterSubmit,
  useLoginFlow,
  useRememberLogin,
  useVerifyCodeSubmit
} from "../useLoginFlow";

defineOptions({
  name: "Login"
});

const verifyCodeRef = ref<{
  getRef?: () => FormInstance;
}>();
const { t } = useI18n();

const {
  checked,
  loginDay,
  loginDayList,
  formatLoginDayOptions,
  syncRememberToStore
} = useRememberLogin();

const {
  loading,
  disabled,
  mustChangePassword,
  loginMfaInfo,
  afterTokenIssued,
  handleMfaBack
} = useLoginFlow();

/** 登录 MFA 验证通过：写入正式 token 并进入系统 */
const handleMfaSuccess = (data: TokenInfo) => afterTokenIssued(data, "login");

const { authInfo, configLoading, onConfig } = useAuthInfo();

const formData = ref({
  form_type: "",
  verify_code: "",
  verify_token: undefined as string | undefined
});

const onLogin = async () => {
  loading.value = true;
  const data = await buildVerifyCodePayload(formData.value, authInfo.value);

  handleOperation({
    t,
    apiReq: loginVerifyCodeApi(data),
    // 成功提示统一由登录流弹出「登录成功」，关掉 handleOperation 默认的 detail 提示
    showSuccessMsg: false,
    success(res) {
      // 登录载荷：正常登录为 TokenInfo；开启登录 MFA 时为 mfa_required 引导信息
      const result = res?.data as LoginResultData;
      if ("mfa_required" in result && result.mfa_required) {
        // 密码阶段通过，切换到登录 MFA 动态码验证步骤
        loginMfaInfo.value = result;
        mustChangePassword.value = Boolean(result.must_change_password);
        return;
      }
      // 登录接口详情数据即 TokenInfo：写 token 并进入系统
      afterTokenIssued(result as TokenInfo);
    },
    requestEnd() {
      loading.value = false;
    }
  });
};

onMounted(() => {
  configLoading.value = true;
});

const configReqSuccess = (verifyCodeConfig: RecordType) => {
  onConfig(verifyCodeConfig);
  loginDay.value = authInfo.value.lifetime ?? 1;
  formatLoginDayOptions();
  syncRememberToStore();
};

// 本页无第二层表单：只校验验证码表单即提交（formRef 省略）
const handleLogin = useVerifyCodeSubmit({
  verifyRef: verifyCodeRef,
  onSubmit: onLogin
});

/** 回车提交（随组件卸载自动移除监听） */
useEnterSubmit(() => handleLogin());

const onBack = backToBasicPage;
</script>

<template>
  <div v-loading="configLoading">
    <LoginMfa
      v-if="loginMfaInfo"
      :mfa-info="loginMfaInfo"
      @success="handleMfaSuccess"
      @back="handleMfaBack"
    />
    <template v-else>
      <ReSendVerifyCode
        ref="verifyCodeRef"
        v-model="formData"
        category="login"
        @configReqSuccess="configReqSuccess"
        @configReqEnd="configLoading = false"
      />

      <el-form v-if="authInfo.access" :model="formData" size="large">
        <Motion :delay="250">
          <el-form-item>
            <div class="w-full h-5 flex-bc">
              <RememberLogin
                v-model:checked="checked"
                v-model:login-day="loginDay"
                :login-day-list="loginDayList"
              />
              <el-button
                v-if="authInfo.reset"
                link
                type="primary"
                @click="
                  useLoginPageStoreHook().SET_CURRENT_PAGE(
                    LOGIN_PAGE.resetPassword
                  )
                "
              >
                {{ t("login.forget") }}
              </el-button>
            </div>
            <el-button
              :disabled="disabled"
              :loading="loading"
              class="w-full mt-4!"
              size="default"
              type="primary"
              @click="handleLogin"
            >
              {{ t("login.login") }}
            </el-button>
          </el-form-item>
        </Motion>
      </el-form>
      <Motion v-else :delay="300">
        <el-result icon="error" :title="t('login.serverForbidden')" />
      </Motion>
      <Motion :delay="350">
        <OAuthEntry />
      </Motion>
      <Motion :delay="400">
        <el-form-item>
          <el-button class="w-full" size="default" @click="onBack">
            {{ t("login.back") }}
          </el-button>
        </el-form-item>
      </Motion>
    </template>
  </div>
</template>
