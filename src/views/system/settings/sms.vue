<script lang="ts" setup>
import {
  settingsSmsBackendsApi,
  settingsSmsConfigApi,
  settingsSmsServerApi
} from "@/api/settings/settings";
import { computed, onMounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";

defineOptions({
  name: "SettingSms"
});

const smsBackends = ref([]);
const settingData = computed<Array<settingItemProps>>(() => {
  return [
    ...[
      {
        auth: {
          update: hasAuth("update:SettingSms"),
          detail: hasAuth("detail:SettingSms")
        },
        api: settingsSmsServerApi,
        localeName: "settingSms"
      }
    ],
    ...smsBackends.value
  ];
});

onMounted(() => {
  hasAuth("list:SettingSmsBackends") &&
    settingsSmsBackendsApi.detail().then(res => {
      if (res.code === 1000) {
        smsBackends.value = [];
        res.data.forEach(item => {
          smsBackends.value.push({
            auth: {
              update: hasAuth("update:SettingSmsConfig"),
              detail: hasAuth("detail:SettingSmsConfig"),
              test: hasAuth("test:SettingSmsConfig")
            },
            api: settingsSmsConfigApi,
            queryParams: { category: item.value },
            localeName: "settingSms",
            label: item.label
          });
        });
      }
    });
});
</script>

<template>
  <setting :model-value="settingData" />
</template>
