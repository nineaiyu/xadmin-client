<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { reactive, ref } from "vue";
import Motion from "../utils/motion";
import type { FormInstance, FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import { resetPasswordApi } from "@/api/auth";
import { handleOperation } from "@/components/RePlusCRUD";
import { AesEncrypted } from "@/utils/aes";
import { passwordRulesCheck } from "@/utils";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";

const { t } = useI18n();
const loading = ref(false);
const formData = ref({
  password: "",
  repeatPassword: "",
  verify_code: "",
  verify_token: undefined
});

const authInfo = ref({
  access: false,
  encrypted: false,
  password: []
});

const formDataRef = ref<FormInstance>();
const verifyCodeRef = ref();

const handleSubmit = () => {
  verifyCodeRef.value.getRef().validate(isValid => {
    if (isValid) {
      formDataRef.value.validate(valid => {
        if (valid) {
          loading.value = true;
          const data = {
            verify_token: formData.value.verify_token,
            password: formData.value.password,
            verify_code: formData.value.verify_code
          };
          if (authInfo.value.encrypted) {
            data["password"] = AesEncrypted(
              data["verify_token"],
              data["password"]
            );
            data["target"] = AesEncrypted(data["verify_token"], data["target"]);
          }
          handleOperation({
            t,
            apiReq: resetPasswordApi(data),
            success() {
              onBack();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        }
      });
    }
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
const handleChange = ({ verifyCodeConfig }) => {
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
};
</script>

<template>
  <div>
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      category="reset"
      @change="handleChange"
    />
    <el-form
      v-if="authInfo.access"
      ref="formDataRef"
      :model="formData"
      :rules="formRules"
      size="large"
    >
      <div v-if="formData.verify_token">
        <Motion :delay="150">
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

        <Motion :delay="200">
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
        <Motion :delay="250">
          <el-form-item>
            <el-button
              :loading="loading"
              class="w-full"
              size="default"
              type="primary"
              @click="handleSubmit"
            >
              {{ t("login.definite") }}
            </el-button>
          </el-form-item>
        </Motion>
      </div>
      <Motion :delay="300">
        <el-form-item>
          <el-button class="w-full" size="default" @click="onBack">
            {{ t("login.back") }}
          </el-button>
        </el-form-item>
      </Motion>
    </el-form>
  </div>
</template>
