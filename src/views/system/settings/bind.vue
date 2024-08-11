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
      update: hasAuth("update:SettingBindEmail"),
      detail: hasAuth("detail:SettingBindEmail")
    },
    api: settingsBindEmailApi,
    localeName: "settingBind"
  },
  {
    auth: {
      update: hasAuth("update:SettingBindPhone"),
      detail: hasAuth("detail:SettingBindPhone")
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
