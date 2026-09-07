<script lang="ts" setup>
/**
 * 账户设置页「MFA 安全」面板：复用个人中心的 OTP 绑定表单，
 * 按账户页面板规范补 h3 标题与宽度约束（对齐 Profile / AccountManagement）。
 */
import { deviceDetection } from "@pureadmin/utils";
import EditUserMfa from "@/views/user/info/components/mfa.vue";

defineOptions({
  name: "AccountMfaSecurity"
});
</script>

<template>
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">{{ $t("mfa.tabTitle") }}</h3>
    <EditUserMfa />
  </div>
</template>
