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
      partialUpdate: hasAuth("partialUpdate:SettingVerify"),
      retrieve: hasAuth("retrieve:SettingVerify")
    },
    api: settingsVerifyCodeApi,
    localeName: "settingVerify"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:settingCaptcha"),
      retrieve: hasAuth("retrieve:settingCaptcha")
    },
    api: settingsCaptchaApi,
    title: "captcha",
    localeName: "settingVerify"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
