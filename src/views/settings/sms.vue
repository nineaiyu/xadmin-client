<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import {
  settingsSmsConfigApi,
  settingsSmsServerApi
} from "@/api/system/settings";
import { computed, onMounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/settings/components/settings/types";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import type { RecordType } from "plus-pro-components";

defineOptions({
  name: "SettingSms"
});

const smsBackends = ref<Array<settingItemProps>>([]);
// 渠道实例（ViewBaseApi 子类）与动态子项合并：类实例的私有成员不参与结构比较，
// 在此按设置项契约收窄（运行时即 ViewBaseApi 实例）
const settingData = computed<Array<settingItemProps>>(
  () =>
    [
      {
        auth: settingAuth("SmsSetting"),
        api: settingsSmsServerApi,
        localeName: "settingSms"
      },
      ...smsBackends.value
    ] as unknown as Array<settingItemProps>
);

onMounted(() => {
  hasAuth("backends:SmsSetting") &&
    settingsSmsServerApi
      .backends()
      .then(res => {
        if (res.code === SUCCESS_CODE) {
          smsBackends.value = [];
          res.data.forEach((item: RecordType) => {
            smsBackends.value.push({
              auth: settingAuth("SmsConfig", true),
              api: settingsSmsConfigApi,
              queryParams: { category: item.value },
              localeName: "settingSms",
              label: item.label
            });
          });
        }
      })
      .catch(() => {
        // http 层已统一提示；渠道子页签缺失属于可见的降级态，这里收尾防止 unhandled rejection
      });
});
</script>

<template>
  <setting :model-value="settingData" />
</template>
