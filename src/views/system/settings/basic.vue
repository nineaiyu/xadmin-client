<script lang="ts" setup>
import {
  settingsBasicApi,
  settingsLoginAuthApi
} from "@/api/settings/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/system/components/settings/index.vue";
import { settingItemProps } from "@/views/system/components/settings/types";

defineOptions({
  name: "SettingBasic"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingBasic"),
      detail: hasAuth("detail:SettingBasic")
    },
    api: settingsBasicApi,
    localeName: "settingBasic"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
