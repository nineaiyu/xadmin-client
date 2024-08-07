<script lang="ts" setup>
import {
  settingsLoginAuthApi,
  settingsLoginLimitApi
} from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/system/components/settings/index.vue";
import { settingItemProps } from "@/views/system/components/settings/types";

defineOptions({
  name: "SettingLogin"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingLoginAuth"),
      detail: hasAuth("detail:SettingLoginAuth")
    },
    api: settingsLoginAuthApi,
    localeName: "settingLogin"
  },
  {
    auth: {
      update: hasAuth("update:SettingLoginLimit"),
      detail: hasAuth("detail:SettingLoginLimit")
    },
    api: settingsLoginLimitApi,
    localeName: "settingLogin",
    title: "limit"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
