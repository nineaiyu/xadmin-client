<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import ReCol from "@/components/ReCol";
import { FormPasswordProps } from "./utils/types";
import type { FormRules } from "element-plus";
import { hasAuth } from "@/router/utils";
import { isAllEmpty } from "@pureadmin/utils";
import { zxcvbn } from "@zxcvbn-ts/core";
import { useI18n } from "vue-i18n";
import { $t, transformI18n } from "@/plugins/i18n";
import { REGEXP_PWD } from "@/views/login/utils/rule";

defineOptions({
  name: "editUserPassword"
});
const { t } = useI18n();

const pwdProgress = [
  { color: "#e74242", text: t("password.veryWeak") },
  { color: "#EFBD47", text: t("password.weak") },
  { color: "#ffa500", text: t("password.average") },
  { color: "#1bbf1b", text: t("password.strong") },
  { color: "#008000", text: t("password.veryStrong") }
];

const password = reactive<FormPasswordProps>({
  old_password: "",
  new_password: "",
  sure_password: ""
});

const ruleFormRef = ref();
const curScore = ref();
const formPasswordRules = reactive<FormRules>({
  old_password: [
    {
      required: true,
      message: t("userinfo.verifyOldPassword"),
      trigger: "blur"
    }
  ],
  new_password: [
    {
      required: true,
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("userinfo.verifyNewPassword"))));
        } else if (!REGEXP_PWD.test(value)) {
          callback(new Error(transformI18n($t("login.passwordRuleReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  sure_password: [
    {
      validator: (rule, value, callback) => {
        if (value !== password.new_password) {
          callback(new Error(t("login.passwordDifferentReg")));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

const emit = defineEmits<{
  (e: "handleUpdate", v: FormPasswordProps): void;
}>();

const handleUpdate = row => {
  ruleFormRef.value.validate(valid => {
    if (valid) {
      emit("handleUpdate", row);
    }
  });
};

watch(
  password,
  ({ new_password }) =>
    (curScore.value = isAllEmpty(new_password)
      ? -1
      : zxcvbn(new_password).score)
);
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="password"
    :rules="formPasswordRules"
    label-width="130px"
  >
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('userinfo.oldPassword')" prop="old_password">
          <el-input
            v-model="password.old_password"
            clearable
            show-password
            type="password"
            :placeholder="t('userinfo.verifyOldPassword')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('userinfo.newPassword')" prop="new_password">
          <el-input
            v-model="password.new_password"
            clearable
            show-password
            type="password"
            :placeholder="t('userinfo.verifyNewPassword')"
          />
          <div class="mt-4 flex w-full">
            <div
              v-for="(item, index) in pwdProgress"
              :key="index"
              class="w-1/5"
              :style="{ marginLeft: index !== 0 ? '4px' : 0 }"
            >
              <el-progress
                striped
                striped-flow
                :duration="curScore === index ? 6 : 0"
                :percentage="curScore >= index ? 100 : 0"
                :color="item.color"
                :stroke-width="10"
                :show-text="false"
              />
              <p
                class="text-center"
                :style="{ color: curScore === index ? item.color : '' }"
              >
                {{ item.text }}
              </p>
            </div>
          </div>
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('userinfo.surePassword')" prop="sure_password">
          <el-input
            v-model="password.sure_password"
            clearable
            show-password
            type="password"
            :placeholder="t('userinfo.verifyNewPassword')"
          />
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        v-if="hasAuth('update:UserInfoPassword')"
        :title="t('buttons.hsconfirmdupdate')"
        @confirm="handleUpdate(password)"
      >
        <template #reference>
          <el-button>{{ t("buttons.hssave") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
