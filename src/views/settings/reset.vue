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
      partialUpdate: hasAuth("partialUpdate:SettingReset"),
      retrieve: hasAuth("retrieve:SettingReset")
    },
    api: settingsResetPasswordCodeApi,
    localeName: "settingReset"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
