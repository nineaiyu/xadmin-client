<script lang="ts" setup>
import { settingsPasswordApi } from "@/api/system/settings";

import { hasAuth } from "@/router/utils";
import { computed } from "vue";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";

defineOptions({
  name: "SettingPassword"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingPassword"),
      detail: hasAuth("detail:SettingPassword")
    },
    api: settingsPasswordApi,
    localeName: "settingPassword"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
