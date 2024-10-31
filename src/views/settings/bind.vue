<script lang="ts" setup>
import {
  settingsBindEmailApi,
  settingsBindPhoneApi
} from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/system/components/settings/index.vue";
import { settingItemProps } from "@/views/system/components/settings/types";

defineOptions({
  name: "SettingBind"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingBindEmail"),
      retrieve: hasAuth("retrieve:SettingBindEmail")
    },
    api: settingsBindEmailApi,
    localeName: "settingBind"
  },
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingBindPhone"),
      retrieve: hasAuth("retrieve:SettingBindPhone")
    },
    api: settingsBindPhoneApi,
    localeName: "settingBind",
    title: "bindPhone"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
