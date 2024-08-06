<script lang="ts" setup>
import {
  settingsEmailServerApi,
  settingsEmailTestApi
} from "@/api/settings/settings";
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
      update: hasAuth("update:SettingEmailServer"),
      detail: hasAuth("detail:SettingEmailServer")
    },
    api: settingsEmailServerApi,
    localeName: "settingEmail"
  },
  {
    auth: {
      update: hasAuth("update:SettingEmailTest"),
      detail: hasAuth("detail:SettingEmailTest"),
      test: hasAuth("test:SettingEmailTest")
    },
    api: settingsEmailTestApi,
    localeName: "settingEmail",
    title: "test"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
