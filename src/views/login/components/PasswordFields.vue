<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import Motion from "../utils/motion";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Lock from "~icons/ri/lock-fill";
import type { FormRules } from "element-plus";

defineOptions({
  name: "PasswordFields"
});

const { t } = useI18n();

/**
 * 密码 + 确认密码两个表单项：注册与重置密码两页的模板逐字相同（Motion 包裹
 * 与 delay 值保持一致，视觉零变化），收敛为本组件。规则由调用方传入
 * （createPasswordFormRules 的产物），双向绑定 password / repeatPassword。
 */
defineProps<{
  password: string;
  repeatPassword: string;
  rules?: FormRules;
  passwordDelay?: number;
  repeatDelay?: number;
}>();
const emit = defineEmits<{
  /** 密码输入（双向绑定 password） */
  "update:password": [value: string];
  /** 确认密码输入（双向绑定 repeatPassword） */
  "update:repeatPassword": [value: string];
}>();
</script>

<template>
  <div>
    <Motion :delay="passwordDelay ?? 150">
      <el-form-item prop="password">
        <el-input
          :model-value="password"
          :placeholder="t('login.password')"
          :prefix-icon="useRenderIcon(Lock)"
          clearable
          show-password
          @update:model-value="emit('update:password', $event)"
        />
      </el-form-item>
    </Motion>

    <Motion :delay="repeatDelay ?? 200">
      <el-form-item prop="repeatPassword">
        <el-input
          :model-value="repeatPassword"
          :placeholder="t('login.sure')"
          :prefix-icon="useRenderIcon(Lock)"
          clearable
          show-password
          @update:model-value="emit('update:repeatPassword', $event)"
        />
      </el-form-item>
    </Motion>
  </div>
</template>
