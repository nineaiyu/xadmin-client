<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useRouter } from "vue-router";
import { operates, thirdParty } from "../utils/enums";
import { useUserStoreHook } from "@/store/modules/user";
import { getTopMenu, initRouter } from "@/router/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import User from "@iconify-icons/ri/user-3-fill";
import Info from "@iconify-icons/ri/information-line";
import { loginVerifyCodeApi } from "@/api/auth";
import { debounce, delay } from "@pureadmin/utils";
import { useEventListener } from "@vueuse/core";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { AesEncrypted } from "@/utils/aes";
import { handleOperation } from "@/components/RePlusCRUD";
import { setToken } from "@/utils/auth";

defineOptions({
  name: "Login"
});

const router = useRouter();
const loading = ref(false);
const checked = ref(true);
const disabled = ref(false);
const loginDay = ref(1);
const loginDayList = ref([1]);
const verifyCodeRef = ref();

const { t } = useI18n();

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
  verify_token: undefined
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

const onLogin = () => {
  loading.value = true;
  const data = {
    verify_token: formData.value.verify_token,
    password: formData.value.password,
    verify_code: formData.value.verify_code
  };
  if (authInfo.value.encrypted) {
    data["password"] = AesEncrypted(data["verify_token"], data["password"]);
    data["target"] = AesEncrypted(data["verify_token"], data["target"]);
  }

  handleOperation({
    t,
    apiReq: loginVerifyCodeApi(data),
    success(res) {
      setToken(res.data);
      initRouter().then(() => {
        disabled.value = true;
        router.push(getTopMenu(true).path).finally(() => {
          disabled.value = false;
        });
      });
    },
    requestEnd() {
      loading.value = false;
    }
  });
};

const immediateDebounce: any = debounce(() => handleLogin(), 1000, true);

/** 使用公共函数，避免`removeEventListener`失效 */
function onkeypress({ code }: KeyboardEvent) {
  if (code === "Enter" || code === "NumpadEnter") {
    handleLogin();
  }
}

onMounted(() => {
  window.document.addEventListener("keypress", onkeypress);
});

onBeforeUnmount(() => {
  useEventListener(document, "keypress", ({ code }) => {
    if (
      ["Enter", "NumpadEnter"].includes(code) &&
      !disabled.value &&
      !loading.value
    )
      immediateDebounce();
  });
});
watch(checked, bool => {
  useUserStoreHook().SET_ISREMEMBERED(bool);
});
watch(loginDay, value => {
  useUserStoreHook().SET_LOGINDAY(value);
});

const configReqSuccess = verifyCodeConfig => {
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);

  loginDay.value = authInfo.value.lifetime;
  formatLoginDayList();
  useUserStoreHook().SET_ISREMEMBERED(checked.value);
  useUserStoreHook().SET_LOGINDAY(loginDay.value);

  formData.value.form_type = authInfo.value.basic ? "username" : "";
};

const isUsername = computed(() => formData.value.form_type === "username");

const handleLogin = () => {
  verifyCodeRef.value?.getRef()?.validate(isValid => {
    if (isValid) {
      if (isUsername.value) {
        verifyCodeRef.value?.handleSendCode(({ verify_code, verify_token }) => {
          formData.value.verify_code = verify_code;
          formData.value.verify_token = verify_token;
          delay().then(() => onLogin());
        });
      } else {
        onLogin();
      }
    }
  });
};
</script>

<template>
  <div>
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      category="login"
      @configReqSuccess="configReqSuccess"
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
          <div class="w-full h-[20px] flex justify-between items-center">
            <el-checkbox v-model="checked">
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
            @click="handleLogin"
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
