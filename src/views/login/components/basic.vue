<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "../utils/rule";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { operates, thirdParty } from "../utils/enums";
import { useUserStoreHook } from "@/store/modules/user";
import { getTopMenu, initRouter } from "@/router/utils";
import { ReImageVerify } from "@/components/ReImageVerify";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import User from "@iconify-icons/ri/user-3-fill";
import Info from "@iconify-icons/ri/information-line";
import { AuthInfoResult, getTempTokenApi, loginAuthApi } from "@/api/auth";
import { cloneDeep, debounce } from "@pureadmin/utils";
import { useEventListener } from "@vueuse/core";

defineOptions({
  name: "BasicLogin"
});

const router = useRouter();
const loading = ref(false);
const configLoading = ref(false);
const checked = ref(true);
const disabled = ref(false);
const loginDay = ref(1);
const loginDayList = ref([1]);
const ruleFormRef = ref<FormInstance>();

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
            message(transformI18n($t("login.loginSuccess")), {
              type: "success"
            });
            initRouter()
              .then(() => {
                disabled.value = true;
                router.push(getTopMenu(true).path).finally(() => {
                  disabled.value = false;
                });
              })
              .finally(() => (loading.value = false));
          } else {
            message(res.detail, {
              type: "warning"
            });
          }
        })
        .finally(() => {
          loading.value = false;
          initToken();
        });
    } else {
      loading.value = false;
    }
  });
};

const immediateDebounce: any = debounce(
  formRef => onLogin(formRef),
  1000,
  true
);

/** 使用公共函数，避免`removeEventListener`失效 */
function onkeypress({ code }: KeyboardEvent) {
  if (code === "Enter" || code === "NumpadEnter") {
    onLogin(ruleFormRef.value);
  }
}

onMounted(() => {
  window.document.addEventListener("keypress", onkeypress);
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
  useEventListener(document, "keypress", ({ code }) => {
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
              :prefix-icon="useRenderIcon('ri:shield-keyhole-line')"
              clearable
            >
              <template v-slot:append>
                <ReImageVerify v-model="ruleForm.captcha_key" />
              </template>
            </el-input>
          </el-form-item>
        </Motion>
      </div>
      <Motion :delay="250">
        <el-form-item>
          <div class="w-full h-[20px] flex justify-between items-center">
            <el-checkbox v-model="checked" tabindex="100">
              <span class="flex">
                <select
                  v-model="loginDay"
                  :disabled="loginDayList.length < 2"
                  :style="{
                    width: loginDay < 10 ? '10px' : '16px',
                    outline: 'none',
                    background: 'none',
                    appearance: 'none'
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
            class="w-full mt-4"
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
        <div class="w-full h-[20px] flex justify-between items-center">
          <el-button
            v-for="(item, index) in operates"
            :key="index"
            class="w-full mt-4"
            size="default"
            @click="useUserStoreHook().SET_CURRENT_PAGE(index + 1)"
          >
            {{ t(item.title) }}
          </el-button>
        </div>
      </el-form-item>
    </Motion>
  </div>
</template>
