<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { reactive, ref } from "vue";
import Motion from "../utils/motion";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { useVerifyCode } from "../utils/verifyCode";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import { getTopMenu, initRouter } from "@/router/utils";
import { useRouter } from "vue-router";
import { passwordRulesCheck } from "@/utils";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import { AesEncrypted } from "@/utils/aes";

const { t } = useI18n();
const checked = ref(false);
const loading = ref(false);
const authInfo = ref({
  access: false,
  encrypted: false,
  password: []
});
const ruleForm = ref({
  username: "",
  password: "",
  repeatPassword: "",
  target: "",
  verify_code: "",
  verify_token: undefined
});
const ruleFormRef = ref<FormInstance>();
const verifyCodeRef = ref();

const router = useRouter();
const onRegister = (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  verifyCodeRef.value?.getRef()?.validate(isValid => {
    if (isValid) {
      formEl.validate(valid => {
        loading.value = true;
        if (valid) {
          if (checked.value) {
            const data = {
              verify_token: ruleForm.value.verify_token,
              password: ruleForm.value.password,
              verify_code: ruleForm.value.verify_code
            };
            if (authInfo.value.encrypted) {
              data["password"] = AesEncrypted(
                data["verify_token"],
                data["password"]
              );
              data["target"] = AesEncrypted(
                data["verify_token"],
                data["target"]
              );
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
    }
  });
};

function onBack() {
  useVerifyCode().end();
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
        } else if (ruleForm.value.password !== value) {
          callback(new Error(transformI18n($t("login.passwordDifferentReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

const handleChange = ({ formData, verifyCodeConfig }) => {
  ruleForm.value = Object.assign(ruleForm.value, formData);
  authInfo.value = Object.assign(authInfo.value, verifyCodeConfig);
};
</script>

<template>
  <div>
    <ReSendVerifyCode
      ref="verifyCodeRef"
      category="register"
      @change="handleChange"
    />

    <el-form
      v-if="authInfo.access"
      ref="ruleFormRef"
      :model="ruleForm"
      :rules="formRules"
      size="large"
    >
      <div v-if="ruleForm.verify_token">
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
      </div>
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
