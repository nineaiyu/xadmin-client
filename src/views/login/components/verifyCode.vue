<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { ref } from "vue";
import Motion from "../utils/motion";
import type { FormInstance } from "element-plus";
import { useVerifyCode } from "../utils/verifyCode";
import { useUserStoreHook } from "@/store/modules/user";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { loginVerifyCodeApi } from "@/api/auth";
import { handleOperation } from "@/components/RePlusCRUD";
import { getTopMenu, initRouter } from "@/router/utils";
import { useRouter } from "vue-router";
import { setToken } from "@/utils/auth";
const router = useRouter();

const { t } = useI18n();
const loading = ref(false);
const authInfo = ref({
  access: false,
  encrypted: false,
  password: []
});
const ruleForm = ref({
  target: "",
  verify_code: "",
  verify_token: undefined
});
const ruleFormRef = ref<FormInstance>();
const verifyCodeRef = ref();

const onLogin = () => {
  verifyCodeRef.value?.getRef()?.validate(isValid => {
    if (isValid) {
      loading.value = true;
      const data = {
        verify_token: ruleForm.value.verify_token,
        verify_code: ruleForm.value.verify_code
      };
      handleOperation({
        t,
        apiReq: loginVerifyCodeApi(data),
        success(res) {
          setToken(res.data);
          initRouter().then(() => {
            router.push(getTopMenu(true).path).finally(() => {});
          });
        },
        requestEnd() {
          loading.value = false;
        }
      });
    }
  });
};

function onBack() {
  useVerifyCode().end();
  useUserStoreHook().SET_CURRENT_PAGE(0);
}

const handleChange = ({ formData, verifyCodeConfig }) => {
  ruleForm.value = Object.assign(ruleForm.value, formData);
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
};
</script>

<template>
  <ReSendVerifyCode
    ref="verifyCodeRef"
    category="login"
    @change="handleChange"
  />

  <el-form ref="ruleFormRef" size="large">
    <Motion v-if="authInfo.access" :delay="150">
      <el-form-item>
        <el-button
          :loading="loading"
          class="w-full"
          size="default"
          type="primary"
          @click="onLogin"
        >
          {{ t("login.login") }}
        </el-button>
      </el-form-item>
    </Motion>

    <Motion :delay="200">
      <el-form-item>
        <el-button class="w-full" size="default" @click="onBack">
          {{ t("login.back") }}
        </el-button>
      </el-form-item>
    </Motion>
  </el-form>
</template>
