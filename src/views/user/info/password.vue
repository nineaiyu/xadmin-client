<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import ReCol from "@/components/ReCol";
import { FormPasswordProps } from "./utils/types";
import type { FormRules } from "element-plus";
import { hasAuth } from "@/router/utils";
import { $t, transformI18n } from "@/plugins/i18n";
import { isAllEmpty } from "@pureadmin/utils";
import { zxcvbn } from "@zxcvbn-ts/core";

defineOptions({
  name: "editUserPassword"
});

const pwdProgress = ref([
  { color: "#e74242", text: "非常弱" },
  { color: "#EFBD47", text: "弱" },
  { color: "#ffa500", text: "一般" },
  { color: "#1bbf1b", text: "强" },
  { color: "#008000", text: "非常强" }
]);

const password = reactive<FormPasswordProps>({
  old_password: "",
  new_password: "",
  sure_password: ""
});

const ruleFormRef = ref();
const curScore = ref();
const formPasswordRules = reactive<FormRules>({
  old_password: [{ required: true, message: "旧密码必填项", trigger: "blur" }],
  new_password: [{ required: true, message: "新密码必填项", trigger: "blur" }],
  sure_password: [
    {
      validator: (rule, value, callback) => {
        if (value !== password.new_password) {
          callback(new Error(transformI18n($t("login.passwordDifferentReg"))));
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
    label-width="82px"
  >
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item label="旧密码" prop="old_password">
          <el-input
            v-model="password.old_password"
            clearable
            show-password
            type="password"
            placeholder="请输入用户旧密码"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="password.new_password"
            clearable
            show-password
            type="password"
            placeholder="请输入用户新密码"
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
        <el-form-item label="确定密码" prop="sure_password">
          <el-input
            v-model="password.sure_password"
            clearable
            show-password
            type="password"
            placeholder="请输入用户新密码"
          />
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        title="是否修改本人密码?"
        @confirm="handleUpdate(password)"
        v-if="hasAuth('update:UserInfoPassword')"
      >
        <template #reference>
          <el-button>保存</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
