<script setup lang="ts">
import { onMounted, ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "@iconify-icons/ri/lock-fill";
import { $t, transformI18n } from "@/plugins/i18n";
import { ifEnableOptions } from "@/constants/constants";
import { useUser } from "./utils/hook";
import { hasAuth } from "@/router/utils";
import Upload from "@iconify-icons/ep/upload";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    sex: 0,
    roles: [],
    password: "",
    repeatPassword: "",
    is_active: true,
    is_edit: false,
    is_reset_password: false
  })
});
const { roleData, getRoleData, updateAvatarDialog, currentAvatarData } =
  useUser();
const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

const repeatPasswordRule = [
  {
    validator: (rule, value, callback) => {
      if (value === "") {
        callback(new Error(transformI18n($t("login.passwordSureReg"))));
      } else if (newFormInline.value.password !== value) {
        callback(new Error(transformI18n($t("login.passwordDifferentReg"))));
      } else {
        callback();
      }
    },
    trigger: "blur"
  }
];

const sexChoices = [
  { label: "男", value: 0 },
  { label: "女", value: 1 },
  { label: "未知", value: 2 }
];

function getRef() {
  return ruleFormRef.value;
}

onMounted(() => {
  getRoleData();
});

function getAvatarFile() {
  return currentAvatarData;
}

defineExpose({ getRef, getAvatarFile });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item label="用户名" prop="username">
      <el-input
        v-model="newFormInline.username"
        clearable
        :disabled="newFormInline.is_reset_password"
        placeholder="请输入用户名"
      />
    </el-form-item>

    <el-form-item label="昵称" prop="nickname">
      <el-input
        v-model="newFormInline.nickname"
        clearable
        :disabled="newFormInline.is_reset_password"
        placeholder="请输入昵称"
      />
    </el-form-item>
    <div v-if="!newFormInline.is_reset_password">
      <el-form-item
        label="头像"
        prop="avatar"
        v-if="hasAuth('upload:systemAvatar')"
      >
        <el-tooltip
          class="box-item"
          effect="dark"
          :content="
            (
              currentAvatarData.img
                ? currentAvatarData.img
                : newFormInline.avatar
            )
              ? '点击修改头像'
              : '点击上传头像'
          "
          placement="right-start"
        >
          <div
            @click="
              updateAvatarDialog(
                currentAvatarData.img,
                newFormInline,
                newFormInline.is_edit
              )
            "
          >
            <el-image
              class="w-[160px] h-[160px]"
              :src="
                currentAvatarData.img
                  ? currentAvatarData.img
                  : newFormInline.avatar
              "
              fit="cover"
            >
              <template #error>
                <div class="image-slot">
                  <component :is="useRenderIcon(Upload)" class="m-1" />
                </div>
              </template>
            </el-image>
          </div>
        </el-tooltip>
      </el-form-item>
      <el-form-item label="手机" prop="mobile">
        <el-input
          v-model="newFormInline.mobile"
          clearable
          placeholder="请输入手机号码"
        />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model="newFormInline.email"
          clearable
          placeholder="请输入邮箱"
        />
      </el-form-item>
      <el-form-item label="性别" prop="sex">
        <el-select
          v-model="newFormInline.sex"
          clearable
          placeholder="请输入性别"
        >
          <el-option
            v-for="item in sexChoices"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
    </div>
    <div v-if="!newFormInline.is_edit">
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="newFormInline.password"
          clearable
          show-password
          placeholder="请输入密码"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
      <el-form-item
        label="确认密码"
        :rules="repeatPasswordRule"
        prop="repeatPassword"
      >
        <el-input
          clearable
          show-password
          v-model="newFormInline.repeatPassword"
          placeholder="请再次输入密码"
          :prefix-icon="useRenderIcon(Lock)"
        />
      </el-form-item>
    </div>
    <div v-if="!newFormInline.is_reset_password">
      <el-form-item label="账户状态" prop="is_active">
        <el-radio-group v-model="newFormInline.is_active">
          <el-radio-button
            v-for="item in ifEnableOptions"
            :key="item.label"
            :label="item.value"
            >{{ item.label }}</el-radio-button
          >
        </el-radio-group>
      </el-form-item>
      <el-form-item label="角色" prop="roles">
        <el-select
          v-model="newFormInline.roles"
          multiple
          clearable
          filterable
          placeholder="请选择角色"
          style="width: 240px"
        >
          <el-option
            v-for="item in roleData"
            :key="item.pk"
            :label="item.name"
            :value="item.pk"
          >
            <span style="float: left">{{ item.name }}</span>
            <span
              style="
                float: right;
                font-size: 13px;
                color: var(--el-text-color-secondary);
              "
              >{{ item.code }}</span
            >
          </el-option>
        </el-select>
      </el-form-item>
    </div>
  </el-form>
</template>
<style scoped>
.image-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 30px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.image-slot .el-icon {
  font-size: 30px;
}
</style>
