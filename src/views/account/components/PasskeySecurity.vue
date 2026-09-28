<script lang="ts" setup>
/**
 * 账户设置页「Passkey 凭据」面板：复用个人凭据管理面板，
 * 按账户页面板规范补 h3 标题与宽度约束（对齐 Profile / MfaSecurity）。
 */
import { deviceDetection } from "@pureadmin/utils";
import UserPasskeyPanel from "./UserPasskeyPanel.vue";

defineOptions({
  name: "AccountPasskeySecurity"
});
</script>

<template>
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">{{ $t("passkey.title") }}</h3>
    <UserPasskeyPanel />
  </div>
</template>
