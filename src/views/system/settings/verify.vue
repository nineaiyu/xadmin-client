<script lang="ts" setup>
import {
  settingsCaptchaApi,
  settingsVerifyCodeApi
} from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/system/components/settings/index.vue";
import { settingItemProps } from "@/views/system/components/settings/types";

defineOptions({
  name: "SettingVerify"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingVerify"),
      detail: hasAuth("detail:SettingVerify")
    },
    api: settingsVerifyCodeApi,
    localeName: "settingVerify"
  },
  {
    auth: {
      update: hasAuth("update:SettingVerify"),
      detail: hasAuth("detail:SettingVerify")
    },
    api: settingsCaptchaApi,
    localeName: "settingVerify"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
