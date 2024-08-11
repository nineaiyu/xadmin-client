<script lang="ts" setup>
import { settingsEmailApi } from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";

defineOptions({
  name: "SettingEmail"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingEmail"),
      detail: hasAuth("detail:SettingEmail"),
      test: hasAuth("test:SettingEmail")
    },
    api: settingsEmailApi,
    localeName: "settingEmail"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
