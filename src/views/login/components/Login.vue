<script lang="ts" setup>
import OAuthEntry from "./OauthEntry.vue";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { LOGIN_PAGE } from "../utils/enums";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "~icons/ri/lock-fill";
import User from "~icons/ri/user-3-fill";
import Info from "~icons/ri/information-line";
import {
  loginVerifyCodeApi,
  type LoginResultData,
  type TokenInfo
} from "@/api/auth";
import { delay } from "@pureadmin/utils";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { handleOperation } from "@/components/RePlusPage";
import LoginMfa from "./LoginMfa.vue";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  createIsUsername,
  useEnterSubmit,
  useLoginFlow,
  useRememberLogin
} from "../useLoginFlow";

defineOptions({
  name: "Login"
});

const configLoading = ref(false);
const verifyCodeRef = ref();
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

const authInfo = ref({
  access: false,
  encrypted: false,
  basic: false,
  lifetime: 1,
  reset: false
});

const formData = ref({
  username: "",
  password: "",
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
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);

  loginDay.value = authInfo.value.lifetime;
  formatLoginDayOptions();
  syncRememberToStore();

  formData.value.form_type = authInfo.value.basic ? "username" : "";
};

const isUsername = createIsUsername(formData);

const handleLogin = () => {
  verifyCodeRef.value?.getRef()?.validate((isValid: boolean) => {
    if (isValid) {
      if (isUsername.value) {
        verifyCodeRef.value?.handleSendCode(
          ({
            verify_code,
            verify_token
          }: {
            verify_code: string;
            verify_token: string;
          }) => {
            formData.value.verify_code = verify_code;
            formData.value.verify_token = verify_token;
            delay().then(() => onLogin());
          }
        );
      } else {
        onLogin();
      }
    }
  });
};

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
      >
        <el-tab-pane
          v-if="authInfo.basic"
          :label="t('login.basic')"
          name="username"
        >
          <Motion v-if="isUsername" :delay="150">
            <el-form-item
              :rules="[
                {
                  required: true,
                  message: t('login.usernameReg'),
                  trigger: 'blur'
                }
              ]"
              prop="username"
            >
              <el-input
                v-model="formData.username"
                :placeholder="t('login.username')"
                :aria-label="t('login.username')"
                :prefix-icon="useRenderIcon(User)"
                clearable
              />
            </el-form-item>
            <el-form-item
              :rules="[
                {
                  required: true,
                  message: t('login.passwordReg'),
                  trigger: 'blur'
                }
              ]"
              prop="password"
            >
              <el-input
                v-model="formData.password"
                :placeholder="t('login.password')"
                :aria-label="t('login.password')"
                :prefix-icon="useRenderIcon(Lock)"
                clearable
                show-password
              />
            </el-form-item>
          </Motion>
        </el-tab-pane>
      </ReSendVerifyCode>

      <el-form v-if="authInfo.access" :model="formData" size="large">
        <Motion :delay="250">
          <el-form-item>
            <div class="w-full h-5 flex-bc">
              <el-checkbox v-model="checked">
                <span class="flex">
                  <select
                    v-model="loginDay"
                    :disabled="loginDayList.length < 2"
                    :style="{
                      width: loginDay < 10 ? '10px' : '16px',
                      background: 'none',
                      appearance: 'none',
                      border: 'none'
                    }"
                  >
                    <option
                      v-for="item in loginDayList"
                      :key="item"
                      :value="item"
                    >
                      {{ item }}
                    </option>
                  </select>
                  {{ t("login.remember") }}
                  <el-tooltip
                    :content="t('login.rememberInfo')"
                    effect="dark"
                    placement="top"
                  >
                    <IconifyIconOffline :icon="Info" class="ml-1" />
                  </el-tooltip>
                </span>
              </el-checkbox>
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
