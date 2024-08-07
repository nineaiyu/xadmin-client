<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { onMounted, reactive, ref } from "vue";
import Motion from "../utils/motion";
import { REGEXP_SIX } from "../utils/rule";
import type { FormInstance, FormRules } from "element-plus";
import { useVerifyCode } from "../utils/verifyCode";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import Iphone from "@iconify-icons/ep/iphone";
import Email from "@iconify-icons/ep/message";
import { ResetInfoResult, resetPasswordApi } from "@/api/reset";
import { getTempTokenApi } from "@/api/auth";
import ReImageVerify from "@/components/ReImageVerify/src/index.vue";
import { handleOperation } from "@/components/RePlusCRUD";
import { cloneDeep } from "lodash-es";
import { AesEncrypted } from "@/utils/aes";
import { passwordRulesCheck } from "@/utils";
import { isEmail, isPhone } from "@pureadmin/utils";

const { t } = useI18n();
const loading = ref(false);
const ruleForm = reactive({
  phone: "",
  email: "",
  verifyCode: "",
  password: "",
  repeatPassword: "",
  token: "",
  captcha_key: "",
  captcha_code: "",
  reset_passwd_token: "",
  form_type: "email"
});

const authInfo = reactive<ResetInfoResult["data"]>({
  access: false,
  captcha: false,
  token: false,
  encrypted: false,
  email: false,
  sms: false,
  rate: 60,
  password: []
});

onMounted(() => {
  resetPasswordApi.detail().then(res => {
    if (res.code === 1000) {
      Object.keys(res.data).forEach(key => {
        authInfo[key] = res.data[key];
      });
      initToken();
    }
  });
});

const initToken = () => {
  if (authInfo.access && authInfo.token) {
    getTempTokenApi().then(res => {
      if (res.code === 1000) {
        ruleForm.token = res.token;
      }
    });
  }
};

const ruleFormRef = ref<FormInstance>();
const { isDisabled, text } = useVerifyCode();

const onUpdate = async () => {
  await ruleFormRef.value.validate(valid => {
    if (valid) {
      loading.value = true;
      const data = {
        token: ruleForm.reset_passwd_token,
        password: ruleForm.password,
        phone: ruleForm.phone,
        email: ruleForm.email,
        form_type: ruleForm.form_type,
        code: ruleForm.verifyCode
      };
      if (authInfo.encrypted) {
        data["password"] = AesEncrypted(data["token"], data["password"]);
        data["phone"] = AesEncrypted(data["token"], data["phone"]);
        data["email"] = AesEncrypted(data["token"], data["email"]);
      }
      handleOperation({
        t,
        apiReq: resetPasswordApi.reset(data),
        success() {
          onBack();
        },
        failed() {
          initToken();
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

const handleSendCode = () => {
  ruleForm.reset_passwd_token = "";
  useVerifyCode().start(
    ruleFormRef.value,
    [ruleForm.form_type, "captcha_code"],
    authInfo.rate,
    interval => {
      const data = cloneDeep(ruleForm);
      if (authInfo.encrypted) {
        data["phone"] = AesEncrypted(data["token"], data["phone"]);
        data["email"] = AesEncrypted(data["token"], data["email"]);
      }
      delete data["verifyCode"];
      handleOperation({
        t,
        apiReq: resetPasswordApi.send(data),
        success(res) {
          ruleForm.reset_passwd_token = res.data.reset_passwd_token;
          interval(authInfo.rate);
        },
        requestEnd() {
          initToken();
        }
      });
    }
  );
};

const formRules = reactive<FormRules>({
  phone: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.phoneReg"))));
        } else if (!isPhone(value)) {
          callback(new Error(transformI18n($t("login.phoneCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  email: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.emailReg"))));
        } else if (!isEmail(value)) {
          callback(new Error(transformI18n($t("login.emailCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  password: [
    {
      required: true,
      validator: (rule, value, callback) => {
        const { result, msg } = passwordRulesCheck(value, authInfo.password, t);
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
        } else if (ruleForm.password !== value) {
          callback(new Error(transformI18n($t("login.passwordDifferentReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  captcha_code: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.verifyCodeReg"))));
        } else if (useUserStoreHook().verifyCodeLength !== value.length) {
          callback(new Error(transformI18n($t("login.verifyCodeCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  verifyCode: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.verifyCodeReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});
</script>

<template>
  <div>
    <el-form
      v-if="authInfo.access && (authInfo.sms || authInfo.email)"
      ref="ruleFormRef"
      :model="ruleForm"
      :rules="formRules"
      size="large"
    >
      <Motion>
        <el-tabs v-model="ruleForm.form_type" class="w-full">
          <el-tab-pane
            v-if="authInfo.sms"
            :label="t('login.smsVerify')"
            name="phone"
          >
            <el-form-item v-if="ruleForm.form_type === 'phone'" prop="phone">
              <el-input
                v-model="ruleForm.phone"
                :placeholder="t('login.phone')"
                :prefix-icon="useRenderIcon(Iphone)"
                clearable
              />
            </el-form-item>
          </el-tab-pane>
          <el-tab-pane
            v-if="authInfo.email"
            :label="t('login.emailVerify')"
            name="email"
          >
            <el-form-item v-if="ruleForm.form_type === 'email'" prop="email">
              <el-input
                v-model="ruleForm.email"
                :placeholder="t('login.email')"
                :prefix-icon="useRenderIcon(Email)"
                clearable
              />
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </Motion>

      <Motion v-if="authInfo.access && authInfo.captcha" :delay="200">
        <el-form-item prop="captcha_code">
          <el-input
            v-model="ruleForm.captcha_code"
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

      <Motion :delay="100">
        <el-form-item prop="verifyCode">
          <div class="w-full flex justify-between">
            <el-input
              v-model="ruleForm.verifyCode"
              :placeholder="t('login.verifyCode')"
              :prefix-icon="useRenderIcon('ri:shield-keyhole-line')"
              clearable
            />
            <el-button
              :disabled="isDisabled"
              class="ml-2"
              @click="handleSendCode"
            >
              {{
                text.length > 0
                  ? text + t("login.info")
                  : t("login.getVerifyCode")
              }}
            </el-button>
          </div>
        </el-form-item>
      </Motion>

      <div v-if="ruleForm.reset_passwd_token">
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

        <Motion :delay="200">
          <el-form-item prop="repeatPassword">
            <el-input
              v-model="ruleForm.repeatPassword"
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
              @click="onUpdate"
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
    <Motion v-else :delay="300">
      <el-result icon="error" title="当前服务器不允许重置密码" />
    </Motion>
  </div>
</template>
