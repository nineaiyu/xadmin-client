<script lang="ts" setup>
import { settingsLdapApi } from "@/api/system/settings";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingsPane } from "@/views/settings/components/settings/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

defineOptions({
  name: "SettingLdap"
});

const { t } = useI18n();

// LDAP/AD 目录同步：复用 SettingItem 的保存/重置/测试按钮；
// 表单列与标签由后端 search-columns + gettext 下发，前端无需逐字段翻译。
// 单面板页面：骨架不渲染左导航，但保留页内标题与「测试只验连接」的边界说明。
const panes = computed<settingsPane[]>(() => [
  {
    key: "ldap",
    label: t("settingLdap.title"),
    desc: t("settingLdap.desc"),
    item: {
      auth: settingAuth("LdapServerSetting", true),
      api: settingsLdapApi,
      localeName: "settingLdap"
    }
  }
]);
</script>

<template>
  <setting :panes="panes" />
</template>
