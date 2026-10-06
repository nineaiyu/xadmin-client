<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { delay } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { onMounted, ref } from "vue";
import type { FormInstance } from "element-plus";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import User from "~icons/ri/user-3-fill";
import Lock from "~icons/ri/lock-fill";
import type { RecordType } from "plus-pro-components";
import {
  backToBasicPage,
  buildVerifyCodePayload,
  createIsUsername,
  createPasswordFormRules,
  useLoginFlow
} from "../useLoginFlow";

const { t } = useI18n();
const checked = ref(false);
const configLoading = ref(false);
/** 隐私政策弹窗：无独立路由，注册页内以对话框展示简要条款 */
const privacyVisible = ref(false);
const authInfo = ref({
  basic: false,
  access: false,
  encrypted: false,
  password: []
});
const formData = ref({
  username: "",
  password: "",
  repeatPassword: "",
  form_type: "",
  verify_code: "",
  verify_token: undefined as string | undefined
});
const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref();

const { loading, handleLoginSuccess } = useLoginFlow();
const handleRegister = () => {
  verifyCodeRef.value?.getRef()?.validate((isValid: boolean) => {
    if (isValid) {
      formDataRef.value?.validate(valid => {
        if (valid) {
          if (checked.value) {
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
                  delay().then(() => onRegister());
                }
              );
            } else {
              onRegister();
            }
          } else {
            message(transformI18n($t("login.tickPrivacy")), {
              type: "warning"
            });
          }
        }
      });
    }
  });
};

const onRegister = async () => {
  loading.value = true;
  const data = await buildVerifyCodePayload(formData.value, authInfo.value);
  useUserStoreHook()
    .registerByUsername(data)
    .then(() => {
      // 注册成功走统一登录流：成功提示、动态路由与 redirect 跳转、loading 收口
      handleLoginSuccess("register");
    })
    .catch(err => {
      loading.value = false;
      message(err.detail, {
        type: "warning"
      });
    });
};

const onBack = backToBasicPage;

const formRules = createPasswordFormRules({
  t,
  getPasswordRules: () => authInfo.value.password,
  getPassword: () => formData.value.password
});

const configReqSuccess = (verifyCodeConfig: RecordType) => {
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
  formData.value.form_type = authInfo.value.basic ? "username" : "";
};

const isUsername = createIsUsername(formData);
onMounted(() => (configLoading.value = true));
</script>

<template>
  <div v-loading="configLoading">
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      category="register"
      @configReqSuccess="configReqSuccess"
      @configReqEnd="configLoading = false"
    >
      <el-tab-pane
        v-if="authInfo.basic"
        :label="t('login.basic')"
        name="username"
      >
        <el-form-item
          v-if="isUsername"
          :rules="[
            {
              required: true,
              message: transformI18n($t('login.usernameReg')),
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
      </el-tab-pane>
    </ReSendVerifyCode>

    <el-form
      v-if="authInfo.access"
      ref="formDataRef"
      :model="formData"
      :rules="formRules"
      size="large"
    >
      <div v-if="formData.verify_token || isUsername">
        <Motion :delay="200">
          <el-form-item prop="password">
            <el-input
              v-model="formData.password"
              :placeholder="t('login.password')"
              :prefix-icon="useRenderIcon(Lock)"
              clearable
              show-password
            />
          </el-form-item>
        </Motion>

        <Motion :delay="250">
          <el-form-item prop="repeatPassword">
            <el-input
              v-model="formData.repeatPassword"
              :placeholder="t('login.sure')"
              :prefix-icon="useRenderIcon(Lock)"
              clearable
              show-password
            />
          </el-form-item>
        </Motion>
      </div>
      <Motion :delay="300">
        <el-form-item>
          <el-checkbox v-model="checked">
            {{ t("login.readAccept") }}
          </el-checkbox>
          <el-button link type="primary" @click="privacyVisible = true">
            {{ t("login.privacyPolicy") }}
          </el-button>
        </el-form-item>
      </Motion>

      <Motion :delay="350">
        <el-form-item>
          <el-button
            :loading="loading"
            class="w-full"
            size="default"
            type="primary"
            @click="handleRegister"
          >
            {{ t("login.definite") }}
          </el-button>
        </el-form-item>
      </Motion>
    </el-form>
    <Motion v-else :delay="300">
      <el-result icon="error" :title="t('login.serverRegisterForbidden')" />
    </Motion>
    <Motion :delay="400">
      <el-form-item>
        <el-button class="w-full" size="default" @click="onBack">
          {{ t("login.back") }}
        </el-button>
      </el-form-item>
    </Motion>

    <el-dialog
      v-model="privacyVisible"
      :title="t('login.privacyPolicy')"
      width="480px"
      append-to-body
    >
      <p class="text-sm/6 text-(--el-text-color-regular)">
        {{ t("login.privacyPolicyBody") }}
      </p>
      <template #footer>
        <el-button type="primary" @click="privacyVisible = false">
          {{ t("login.definite") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
