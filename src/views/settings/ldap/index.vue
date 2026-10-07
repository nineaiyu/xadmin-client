<script lang="ts" setup>
import { settingsLdapApi } from "@/api/system/settings";
import { computed } from "vue";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

defineOptions({
  name: "SettingLdap"
});

// LDAP/AD 目录同步：复用 SettingItem 的保存/重置/测试按钮；
// 表单列与标签由后端 search-columns + gettext 下发，前端无需逐字段翻译
const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: settingAuth("LdapServerSetting", true),
    api: settingsLdapApi,
    localeName: "settingLdap"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
