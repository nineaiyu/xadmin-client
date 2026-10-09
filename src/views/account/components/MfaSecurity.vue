<script lang="ts" setup>
/**
 * 账户设置页「MFA 安全」面板：复用个人中心的 OTP 绑定表单，
 * 容器 / 标题 / 留白由 AccountPanel 统一提供（对齐其余页签）。
 */
import AccountPanel from "./AccountPanel.vue";
import EditUserMfa from "@/views/account/components/UserMfaPanel.vue";

defineOptions({
  name: "AccountMfaSecurity"
});
</script>

<template>
  <AccountPanel :title="$t('mfa.tabTitle')">
    <EditUserMfa />
  </AccountPanel>
</template>
