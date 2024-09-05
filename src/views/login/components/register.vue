<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { computed, onMounted, reactive, ref } from "vue";
import Motion from "../utils/motion";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import { getTopMenu, initRouter } from "@/router/utils";
import { useRouter } from "vue-router";
import { passwordRulesCheck } from "@/utils";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { AesEncrypted } from "@/utils/aes";
import User from "@iconify-icons/ri/user-3-fill";
import { delay } from "@pureadmin/utils";

const { t } = useI18n();
const checked = ref(false);
const loading = ref(false);
const configLoading = ref(false);
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
  target: "",
  form_type: "",
  verify_code: "",
  verify_token: undefined
});
const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref();

const router = useRouter();
const handleRegister = () => {
  verifyCodeRef.value?.getRef()?.validate(isValid => {
    if (isValid) {
      formDataRef.value?.validate(valid => {
        if (valid) {
          if (checked.value) {
            if (isUsername.value) {
              verifyCodeRef.value?.handleSendCode(
                ({ verify_code, verify_token }) => {
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

const onRegister = () => {
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
  useUserStoreHook()
    .registerByUsername(data)
    .then(() => {
      message(transformI18n($t("login.registerSuccess")), {
        type: "success"
      });
      // 获取后端路由
      initRouter().then(() => {
        router.push(getTopMenu(true).path);
      });
      loading.value = false;
    })
    .catch(err => {
      loading.value = false;
      message(err.detail, {
        type: "warning"
      });
    });
};

function onBack() {
  useUserStoreHook().SET_CURRENT_PAGE(0);
}

const formRules = reactive<FormRules>({
  password: [
    {
      required: true,
      validator: (rule, value, callback) => {
        const { result, msg } = passwordRulesCheck(
          value,
          authInfo.value.password,
          t
        );
        if (result) {
          callback();
        } else {
          callback(new Error(msg));
        }
      },
      trigger: "blur"
    }
  ],
  repeatPassword: [
    {
      required: true,
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.passwordSureReg"))));
        } else if (formData.value.password !== value) {
          callback(new Error(transformI18n($t("login.passwordDifferentReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

const configReqSuccess = verifyCodeConfig => {
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
  formData.value.form_type = authInfo.value.basic ? "username" : "";
};

const isUsername = computed(() => formData.value.form_type === "username");
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
            tabindex="100"
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
              tabindex="100"
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
              tabindex="100"
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
          <el-checkbox v-model="checked" tabindex="800">
            {{ t("login.readAccept") }}
          </el-checkbox>
          <el-button link type="primary">
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
            tabindex="1000"
            @click="handleRegister"
          >
            {{ t("login.definite") }}
          </el-button>
        </el-form-item>
      </Motion>
    </el-form>
    <Motion v-else :delay="300">
      <el-result icon="error" title="当前服务器不允许注册" />
    </Motion>
    <Motion :delay="400">
      <el-form-item>
        <el-button
          class="w-full"
          size="default"
          tabindex="1000"
          @click="onBack"
        >
          {{ t("login.back") }}
        </el-button>
      </el-form-item>
    </Motion>
  </div>
</template>
