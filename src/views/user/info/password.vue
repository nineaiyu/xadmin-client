<script lang="ts" setup>
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
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('userinfo.oldPassword')" prop="old_password">
          <el-input
            v-model="password.old_password"
            :placeholder="t('userinfo.verifyOldPassword')"
            clearable
            show-password
            type="password"
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('userinfo.newPassword')" prop="new_password">
          <el-input
            v-model="password.new_password"
            :placeholder="t('userinfo.verifyNewPassword')"
            clearable
            show-password
            type="password"
          />
          <div class="mt-4 flex w-full">
            <div
              v-for="(item, index) in pwdProgress"
              :key="index"
              :style="{ marginLeft: index !== 0 ? '4px' : 0 }"
              class="w-1/5"
            >
              <el-progress
                :color="item.color"
                :duration="curScore === index ? 6 : 0"
                :percentage="curScore >= index ? 100 : 0"
                :show-text="false"
                :stroke-width="10"
                striped
                striped-flow
              />
              <p
                :style="{ color: curScore === index ? item.color : '' }"
                class="text-center"
              >
                {{ item.text }}
              </p>
            </div>
          </div>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('userinfo.surePassword')" prop="sure_password">
          <el-input
            v-model="password.sure_password"
            :placeholder="t('userinfo.verifyNewPassword')"
            clearable
            show-password
            type="password"
          />
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        v-if="hasAuth('update:UserInfoPassword')"
        :title="t('buttons.confirmUpdate')"
        @confirm="handleUpdate(password)"
      >
        <template #reference>
          <el-button>{{ t("buttons.save") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
