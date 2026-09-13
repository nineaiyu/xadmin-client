<script lang="ts" setup>
import { settingsLdapApi } from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";

defineOptions({
  name: "SettingLdap"
});

// LDAP/AD 目录同步（ADR-017）：复用 SettingItem 的保存/重置/测试按钮；
// 表单列与标签由后端 search-columns + gettext 下发，前端无需逐字段翻译
const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:LdapServerSetting"),
      retrieve: hasAuth("retrieve:LdapServerSetting"),
      test: hasAuth("create:LdapServerSetting")
    },
    api: settingsLdapApi,
    localeName: "settingLdap"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
