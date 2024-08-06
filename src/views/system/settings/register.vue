<script lang="ts" setup>
import { settingsRegisterAuthApi } from "@/api/settings/settings";
import { computed } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";

defineOptions({
  name: "SettingRegister"
});

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      update: hasAuth("update:SettingRegisterAuth"),
      detail: hasAuth("detail:SettingRegisterAuth")
    },
    api: settingsRegisterAuthApi,
    localeName: "settingRegister"
  }
]);
</script>

<template>
  <setting :model-value="settingData" />
</template>
