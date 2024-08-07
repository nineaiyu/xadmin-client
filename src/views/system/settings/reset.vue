<script lang="ts" setup>
import { settingsResetPasswordCodeApi } from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";

defineOptions({
  name: "SettingReset"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingReset"),
      detail: hasAuth("detail:SettingReset")
    },
    api: settingsResetPasswordCodeApi,
    localeName: "settingReset"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
