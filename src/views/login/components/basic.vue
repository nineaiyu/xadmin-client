<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "../utils/rule";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { operates, thirdParty } from "../utils/enums";
import { useUserStoreHook } from "@/store/modules/user";
import { getTopMenu, initRouter } from "@/router/utils";
import { ReImageVerify } from "@/components/ReImageVerify";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "~icons/ri/lock-fill";
import User from "~icons/ri/user-3-fill";
import Info from "~icons/ri/information-line";
import Keyhole from "~icons/ri/shield-keyhole-line";
import {
  AuthInfoResult,
  getTempTokenApi,
  loginAuthApi,
  type TokenInfo
} from "@/api/auth";
import type { LoginMfaRequired } from "@/api/mfa";
import { setToken } from "@/utils/auth";
import { cloneDeep, debounce } from "@pureadmin/utils";
import { useEventListener } from "@vueuse/core";
import LoginMfa from "./mfa.vue";

defineOptions({
  name: "BasicLogin"
});

const router = useRouter();
const loading = ref(false);
const captchaRef = ref();
const configLoading = ref(false);
const checked = ref(true);
const disabled = ref(false);
const loginDay = ref(1);
const loginDayList = ref([1]);
const ruleFormRef = ref<FormInstance>();
const route = useRoute();
const { t } = useI18n();

const authInfo = reactive<AuthInfoResult["data"]>({
  access: false,
  captcha: false,
  token: false,
  encrypted: false,
  basic: false,
  lifetime: 1,
  reset: false
});

/** 登录 MFA 二次验证载荷：非空时登录页切换为动态码验证步骤 */
const loginMfaInfo = ref<LoginMfaRequired | null>(null);

const ruleForm = reactive({
  username: "",
  password: "",
  token: "",
  captcha_key: "",
  captcha_code: ""
});

const formatLoginDayList = () => {
  const start = 1;
  const middle = Math.ceil(loginDay.value / 2);
  if (middle > 0) {
    if (middle !== start) {
      loginDayList.value.push(middle);
    }
    if (middle !== loginDay.value) {
      loginDayList.value.push(loginDay.value);
    }
  } else {
    loginDayList.value = [loginDay.value];
  }
};

const initToken = () => {
  if (authInfo.access && authInfo.token) {
    getTempTokenApi().then(res => {
      if (res.code === 1000) {
        ruleForm.token = res.token;
      }
    });
  }
};

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername(cloneDeep(ruleForm), authInfo.encrypted)
        .then(res => {
          if (res.code === 1000) {
            if ("mfa_required" in res.data && res.data.mfa_required) {
              // 密码阶段通过，切换到登录 MFA 动态码验证步骤
              loginMfaInfo.value = res.data;
              return;
            }
            handleLoginSuccess();
          } else {
            message(res.detail, {
              type: "warning"
            });
            throw res.detail;
          }
        })
        .catch(() => {
          initToken();
          captchaRef.value?.getImgCode();
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      loading.value = false;
    }
  });
};

/** 登录完成（直接登录成功或 MFA 验证通过）：初始化路由并跳转 */
const handleLoginSuccess = () => {
  message(transformI18n($t("login.loginSuccess")), {
    type: "success"
  });
  initRouter(true)
    .then(() => {
      disabled.value = true;
      router
        .push((route.query?.redirect as string) ?? getTopMenu(true).path)
        .finally(() => {
          disabled.value = false;
        });
    })
    .finally(() => (loading.value = false));
};

/** 登录 MFA 验证通过：写入正式 token 并进入系统 */
const handleMfaSuccess = (data: TokenInfo) => {
  setToken(data);
  handleLoginSuccess();
};

/** 返回重新登录 */
const handleMfaBack = () => {
  loginMfaInfo.value = null;
  initToken();
  captchaRef.value?.getImgCode();
};

const immediateDebounce: (_formRef?: FormInstance | undefined) => void =
  debounce((formRef: FormInstance | undefined) => onLogin(formRef), 1000, true);

/** 使用公共函数，避免`removeEventListener`失效 */
function onkeypress({ code }: KeyboardEvent) {
  if (code === "Enter" || code === "NumpadEnter") {
    onLogin(ruleFormRef.value);
  }
}

onMounted(() => {
  window.document.addEventListener("keydown", onkeypress);
  configLoading.value = true;
  loginAuthApi()
    .then(res => {
      if (res.code === 1000) {
        Object.keys(res.data).forEach(key => {
          authInfo[key] = res.data[key];
        });
        initToken();
        loginDay.value = authInfo.lifetime;
        formatLoginDayList();
        useUserStoreHook().SET_ISREMEMBERED(checked.value);
        useUserStoreHook().SET_LOGINDAY(loginDay.value);
      }
    })
    .finally(() => (configLoading.value = false));
});

onBeforeUnmount(() => {
  useEventListener(document, "keydown", ({ code }) => {
    if (
      ["Enter", "NumpadEnter"].includes(code) &&
      !disabled.value &&
      !loading.value
    )
      immediateDebounce(ruleFormRef.value);
  });
});
watch(checked, bool => {
  useUserStoreHook().SET_ISREMEMBERED(bool);
});
watch(loginDay, value => {
  useUserStoreHook().SET_LOGINDAY(value);
});
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
        <div v-if="authInfo.basic">
          <Motion :delay="100">
            <el-form-item prop="username">
              <el-input
                v-model="ruleForm.username"
                tabindex="100"
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
                tabindex="100"
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
                tabindex="100"
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
        <Motion :delay="250">
          <el-form-item>
            <div class="w-full h-5 flex-bc">
              <el-checkbox v-model="checked" tabindex="100">
                <span class="flex">
                  <select
                    v-model="loginDay"
                    :disabled="loginDayList.length < 2"
                    :style="{
                      width: loginDay < 10 ? '10px' : '16px',
                      outline: 'none',
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
                @click="useUserStoreHook().SET_CURRENT_PAGE(4)"
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
              tabindex="100"
              @click="onLogin(ruleFormRef)"
            >
              {{ t("login.login") }}
            </el-button>
          </el-form-item>
        </Motion>
        <Motion :delay="350">
          <el-form-item>
            <el-divider>
              <p class="text-gray-500 text-xs">{{ t("login.thirdLogin") }}</p>
            </el-divider>
            <div class="w-full flex justify-evenly">
              <span
                v-for="(item, index) in thirdParty"
                :key="index"
                :title="t(item.title)"
              >
                <IconifyIconOnline
                  :icon="`ri:${item.icon}-fill`"
                  class="cursor-pointer text-gray-500 hover:text-blue-400"
                  width="20"
                />
              </span>
            </div>
          </el-form-item>
        </Motion>
      </el-form>
      <Motion v-else :delay="300">
        <el-result icon="error" title="当前服务器不允许登录" />
      </Motion>
      <Motion :delay="300">
        <el-form-item>
          <div class="w-full h-5 flex-bc">
            <el-button
              v-for="(item, index) in operates"
              :key="index"
              class="w-full mt-4!"
              size="default"
              @click="useUserStoreHook().SET_CURRENT_PAGE(index + 1)"
            >
              {{ t(item.title) }}
            </el-button>
          </div>
        </el-form-item>
      </Motion>
    </template>
  </div>
</template>
