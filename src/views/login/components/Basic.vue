<script lang="ts" setup>
import { isSuccess } from "@/api/types";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { loginRules } from "../utils/rule";
import type { FormInstance } from "element-plus";
import { LOGIN_PAGE, operates } from "../utils/enums";
import { useUserStoreHook } from "@/store/modules/user";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { ReImageVerify } from "@/components/ReImageVerify";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation } from "@/components/RePlusPage";
import Lock from "~icons/ri/lock-fill";
import User from "~icons/ri/user-3-fill";
import Keyhole from "~icons/ri/shield-keyhole-line";
import {
  getTempTokenApi,
  loginAuthApi,
  type LoginResultData,
  type TokenInfo
} from "@/api/auth";
import { cloneDeep } from "@pureadmin/utils";
import LoginMfa from "./LoginMfa.vue";
import OAuthEntry from "./OauthEntry.vue";
import RememberLogin from "./RememberLogin.vue";
import LoginPrivacyNotice from "./LoginPrivacyNotice.vue";
import type { RecordType } from "plus-pro-components";
import {
  useAuthInfo,
  useEnterSubmit,
  useLoginFlow,
  useRememberLogin
} from "../useLoginFlow";

defineOptions({
  name: "BasicLogin"
});

const captchaRef = ref();
const ruleFormRef = ref<FormInstance>();
const { t } = useI18n();

const {
  checked,
  loginDay,
  loginDayList,
  formatLoginDayOptions,
  syncRememberToStore
} = useRememberLogin();

const { authInfo, configLoading, onConfig } = useAuthInfo();

/** 账号密码登录开关：配置未返回前按开启处理，避免首帧误报「已关闭」 */
const basicLoginEnabled = computed(() => authInfo.value.basic !== false);

const ruleForm = reactive({
  username: "",
  password: "",
  token: "",
  captcha_key: "",
  captcha_code: ""
});

/**
 * 临时 Token 首次获取的进行中 Promise：登录提交前 await 它，避免「首帧 token 尚未
 * 返回就提交」用空 token 打后端；就绪后复用，不为每次提交重复请求。
 */
let tokenPromise: Promise<void> | null = null;

/** 取一次性临时 Token 写入表单；force=true 强制刷新（登录失败后 token 已被消费） */
const initToken = (force = false) => {
  if (!(authInfo.value.access && authInfo.value.token))
    return Promise.resolve();
  if (!force && tokenPromise) return tokenPromise;
  tokenPromise = getTempTokenApi()
    .then(res => {
      if (isSuccess(res)) {
        ruleForm.token = res.token;
      }
    })
    .catch(() => {
      // 静默失败：真正拦截在提交环节，由失败分支统一提示与刷新
      tokenPromise = null;
    });
  return tokenPromise;
};

/**
 * 登录失败/异常后刷新一次性资源：临时 token 提交即消费、图形验证码校验即消费，
 * 不刷新则用户重试必带失效资源。失败提示由 handleOperation 的默认文案负责。
 */
const refreshLoginResources = () => {
  void initToken(true);
  captchaRef.value?.getImgCode();
};

const {
  loading,
  disabled,
  mustChangePassword,
  loginMfaInfo,
  handleLoginSuccess,
  afterTokenIssued,
  handleMfaBack
} = useLoginFlow({
  // MFA 步骤返回重新登录：刷新一次性临时 token 与图形验证码
  onMfaBack: refreshLoginResources
});

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl || !basicLoginEnabled.value) return;
  await formEl.validate(async valid => {
    if (!valid) {
      loading.value = false;
      return;
    }
    loading.value = true;
    // 临时 Token 必须与本次提交一一对应：首帧 token 请求尚未返回就提交会带着
    // 空 token 打后端，命中「临时Token校验失败」的 400 且不会自动重试。
    // 提交前等 token 就绪（就绪后瞬时返回；失败路径见下方回调的强制刷新）。
    await initToken();
    // 登录请求（user store 封装）：成功时已写 token 并按 mfa_required 分支处理；
    // 失败与异常都走 handleOperation 的回调刷新一次性资源——一次性 token 提交即
    // 消费，不刷新则下次提交必带失效 token（验证码同理）
    handleOperation({
      t,
      apiReq: useUserStoreHook().loginByUsername(
        cloneDeep(ruleForm),
        authInfo.value.encrypted
      ),
      // 成功提示由登录流弹出「登录成功」，关掉默认文案
      showSuccessMsg: false,
      success(res) {
        const result = res?.data as LoginResultData;
        if ("mfa_required" in result && result.mfa_required) {
          // 密码阶段通过，切换到登录 MFA 动态码验证步骤
          loginMfaInfo.value = result;
          mustChangePassword.value = Boolean(result.must_change_password);
          return;
        }
        // 巡检处置联动：管理员要求改密时登录后引导到个人配置页
        mustChangePassword.value = Boolean(result.must_change_password);
        handleLoginSuccess("login");
      },
      // 业务失败（如密码错误）：默认失败提示即面向用户的可读文案，刷新一次性资源
      failed() {
        refreshLoginResources();
      },
      // 请求异常（网络 / 5xx）：同样刷新，保证用户重试时资源就绪
      exception() {
        refreshLoginResources();
      },
      requestEnd() {
        loading.value = false;
      }
    });
  });
};

/** 登录 MFA 验证通过：写入正式 token 并进入系统 */
const handleMfaSuccess = (data: TokenInfo) => afterTokenIssued(data, "login");

/** 回车提交（随组件卸载自动移除监听） */
useEnterSubmit(() => onLogin(ruleFormRef.value));

/** 登录配置失败：与「管理员禁用登录」区分，给重试入口 */
const configFailed = ref(false);
const loadLoginConfig = () => {
  configLoading.value = true;
  configFailed.value = false;
  loginAuthApi()
    .then(res => {
      if (isSuccess(res)) {
        onConfig(res.data as RecordType);
        void initToken();
        loginDay.value = authInfo.value.lifetime ?? 1;
        formatLoginDayOptions();
        syncRememberToStore();
      } else {
        configFailed.value = true;
      }
    })
    .catch(() => {
      configFailed.value = true;
    })
    .finally(() => (configLoading.value = false));
};

onMounted(loadLoginConfig);
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
      <el-form
        v-if="authInfo.access"
        ref="ruleFormRef"
        :model="ruleForm"
        :rules="loginRules"
        size="large"
      >
        <div v-if="basicLoginEnabled">
          <Motion :delay="100">
            <el-form-item prop="username">
              <el-input
                v-model="ruleForm.username"
                :placeholder="t('login.username')"
                :prefix-icon="useRenderIcon(User)"
                clearable
              />
            </el-form-item>
          </Motion>

          <Motion :delay="150">
            <el-form-item prop="password">
              <el-input
                v-model="ruleForm.password"
                :placeholder="t('login.password')"
                :prefix-icon="useRenderIcon(Lock)"
                clearable
                show-password
              />
            </el-form-item>
          </Motion>

          <Motion v-if="authInfo.access && authInfo.captcha" :delay="200">
            <el-form-item prop="captcha_code">
              <el-input
                v-model="ruleForm.captcha_code"
                :placeholder="t('login.verifyCode')"
                :prefix-icon="useRenderIcon(Keyhole)"
                clearable
              >
                <template v-slot:append>
                  <ReImageVerify
                    ref="captchaRef"
                    v-model="ruleForm.captcha_key"
                  />
                </template>
              </el-input>
            </el-form-item>
          </Motion>
        </div>
        <!-- 账号密码登录被关闭：给出可读说明，隐藏无字段可填的提交按钮；
             验证码/第三方入口仍在下方渲染，不把用户困在空表单里 -->
        <Motion v-if="basicLoginEnabled" :delay="250">
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
              @click="onLogin(ruleFormRef)"
            >
              {{ t("login.login") }}
            </el-button>
          </el-form-item>
        </Motion>
        <Motion v-else :delay="250">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            :title="t('login.basicDisabled')"
          />
        </Motion>
        <!-- 第三方登录入口：读取后端已启用 provider，
             替换原静态装饰图标（不接后端、不可点击的死 UI） -->
        <Motion :delay="350">
          <OAuthEntry />
        </Motion>
      </el-form>
      <Motion v-else-if="configFailed" :delay="300">
        <el-result icon="error" :title="t('login.configLoadFailed')">
          <template #extra>
            <el-button type="primary" @click="loadLoginConfig">
              {{ t("buttons.reload") }}
            </el-button>
          </template>
        </el-result>
      </Motion>
      <Motion v-else :delay="300">
        <el-result icon="error" :title="t('login.serverForbidden')" />
      </Motion>
      <!-- 服务整体禁用（authInfo.access=false）时隐藏登录方式切换：目标页同样是「服务已禁止」，保留即成死循环点击面 -->
      <Motion v-if="authInfo.access" :delay="300">
        <el-form-item>
          <div class="w-full h-5 flex-bc">
            <el-button
              v-for="item in operates"
              :key="item.page"
              class="w-full mt-4!"
              size="default"
              @click="useLoginPageStoreHook().SET_CURRENT_PAGE(item.page)"
            >
              {{ t(item.title) }}
            </el-button>
          </div>
        </el-form-item>
      </Motion>
      <Motion :delay="450">
        <LoginPrivacyNotice />
      </Motion>
    </template>
  </div>
</template>
