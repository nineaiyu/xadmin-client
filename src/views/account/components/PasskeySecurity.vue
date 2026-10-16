<script lang="ts" setup>
/**
 * 账户设置页「Passkey 凭据」面板：复用个人凭据管理面板，
 * 容器 / 标题 / 留白由 AccountPanel 统一提供（对齐其余页签）。
 */
import AccountPanel from "./AccountPanel.vue";
import UserPasskeyPanel from "./UserPasskeyPanel.vue";

defineOptions({
  name: "AccountPasskeySecurity"
});
</script>

<template>
  <AccountPanel :title="$t('passkey.title')">
    <UserPasskeyPanel />
  </AccountPanel>
</template>
