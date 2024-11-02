<script lang="ts" setup>
import {
  settingsSmsConfigApi,
  settingsSmsServerApi
} from "@/api/system/settings";
import { computed, onMounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/settings/components/settings/types";
import Setting from "@/views/settings/components/settings/index.vue";

defineOptions({
  name: "SettingSms"
});

const smsBackends = ref([]);
const settingData = computed<Array<settingItemProps>>(() => {
  return [
    ...[
      {
        auth: {
          partialUpdate: hasAuth("partialUpdate:SmsSetting"),
          retrieve: hasAuth("retrieve:SmsSetting")
        },
        api: settingsSmsServerApi,
        localeName: "settingSms"
      }
    ],
    ...smsBackends.value
  ];
});

onMounted(() => {
  hasAuth("backends:SmsSetting") &&
    settingsSmsServerApi.backends().then(res => {
      if (res.code === 1000) {
        smsBackends.value = [];
        res.data.forEach(item => {
          smsBackends.value.push({
            auth: {
              partialUpdate: hasAuth("partialUpdate:SmsConfig"),
              retrieve: hasAuth("retrieve:SmsConfig"),
              test: hasAuth("create:SmsConfig")
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
