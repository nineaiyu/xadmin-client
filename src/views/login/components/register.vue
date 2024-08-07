<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { onMounted, reactive, ref } from "vue";
import Motion from "../utils/motion";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { useVerifyCode } from "../utils/verifyCode";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
// import Iphone from "@iconify-icons/ep/iphone";
import User from "@iconify-icons/ri/user-3-fill";
import { AuthInfoResult, getTempTokenApi, registerAuthApi } from "@/api/auth";
import { getTopMenu, initRouter } from "@/router/utils";
import { useRouter } from "vue-router";
import { cloneDeep } from "@pureadmin/utils";
import ReImageVerify from "@/components/ReImageVerify/src/index.vue";
import { passwordRulesCheck } from "@/utils";

const { t } = useI18n();
const checked = ref(false);
const loading = ref(false);
const authInfo = reactive<AuthInfoResult["data"]>({
  access: false,
  captcha: false,
  token: false,
  encrypted: false,
  password: []
});
const ruleForm = reactive({
  username: "",
  password: "",
  repeatPassword: "",
  token: "",
  captcha_key: "",
  captcha_code: ""
});
const ruleFormRef = ref<FormInstance>();

const router = useRouter();
const onRegister = async (formEl: FormInstance | undefined) => {
  loading.value = true;
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      if (checked.value) {
        useUserStoreHook()
          .registerByUsername(cloneDeep(ruleForm), authInfo.encrypted)
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
            initToken();
          });
      } else {
        loading.value = false;
        message(transformI18n($t("login.tickPrivacy")), {
          type: "warning"
        });
      }
    } else {
      loading.value = false;
    }
  });
};

function onBack() {
  useVerifyCode().end();
  useUserStoreHook().SET_CURRENT_PAGE(0);
}

onMounted(() => {
  registerAuthApi().then(res => {
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

const formRules = reactive<FormRules>({
  username: [
    {
      required: true,
      message: transformI18n($t("login.usernameReg")),
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
  ]
});
</script>

<template>
  <div>
    <el-form
      v-if="authInfo.access"
      ref="ruleFormRef"
      :model="ruleForm"
      :rules="formRules"
      size="large"
    >
      <Motion>
        <el-form-item prop="username">
          <el-input
            v-model="ruleForm.username"
            :placeholder="t('login.username')"
            :prefix-icon="useRenderIcon(User)"
            clearable
          />
        </el-form-item>
      </Motion>

      <Motion :delay="200">
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

      <Motion :delay="250">
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

      <Motion :delay="300">
        <el-form-item>
          <el-checkbox v-model="checked">
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
            @click="onRegister(ruleFormRef)"
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
        <el-button class="w-full" size="default" @click="onBack">
          {{ t("login.back") }}
        </el-button>
      </el-form-item>
    </Motion>
  </div>
</template>
