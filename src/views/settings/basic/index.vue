<script lang="ts" setup>
import { settingsBasicApi, settingsMonitorApi } from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";

defineOptions({
  name: "SettingBasic"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingBasic"),
      retrieve: hasAuth("retrieve:SettingBasic")
    },
    api: settingsBasicApi,
    localeName: "settingBasic"
  },
  {
    // 资源告警属于运维监控配置，从安全设置移入基本设置（菜单按钮同步迁移）
    auth: {
      partialUpdate: hasAuth("partialUpdate:SecurityMonitor"),
      retrieve: hasAuth("retrieve:SecurityMonitor")
    },
    api: settingsMonitorApi,
    localeName: "settingSecurity",
    title: "monitor"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
