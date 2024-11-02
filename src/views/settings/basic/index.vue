<script lang="ts" setup>
import { settingsBasicApi } from "@/api/system/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingItemProps } from "@/views/settings/components/settings/types";

defineOptions({
  name: "SettingBasic"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:SettingBasic"),
      retrieve: hasAuth("retrieve:SettingBasic")
    },
    api: settingsBasicApi,
    localeName: "settingBasic"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
