<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import {
  settingsSmsConfigApi,
  settingsSmsServerApi
} from "@/api/system/settings";
import { computed, onMounted, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { settingItemProps } from "@/views/settings/components/settings/types";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import type { RecordType } from "plus-pro-components";

defineOptions({
  name: "SettingSms"
});

const smsBackends = ref<Array<settingItemProps>>([]);
// 静态渠道项与动态后端子项按 settingItemProps 契约统一（api 槽位为结构化接口，
// ViewBaseApi 及其子类实例均可直接赋给）
const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: settingAuth("SmsSetting"),
    api: settingsSmsServerApi,
    localeName: "settingSms"
  },
  ...smsBackends.value
]);

// 渠道 backends 拉取期间页签容器给 loading：缺失子页签属于可见的过渡态
const backendsLoading = ref(false);

onMounted(async () => {
  if (!hasAuth("backends:SmsSetting")) return;
  backendsLoading.value = true;
  try {
    const res = await settingsSmsServerApi.backends();
    if (res.code === SUCCESS_CODE) {
      smsBackends.value = [];
      (Array.isArray(res.data) ? res.data : []).forEach((item: RecordType) => {
        smsBackends.value.push({
          auth: settingAuth("SmsConfig", true),
          api: settingsSmsConfigApi,
          queryParams: { category: item.value },
          localeName: "settingSms",
          label: item.label
        });
      });
    } else if (res.detail) {
      // 业务码失败点名（此前静默：子页签少了几项无从判断；重试=刷新页面）
      message(String(res.detail), { type: "warning" });
    }
  } catch {
    // http 层已统一提示；渠道子页签缺失属于可见的降级态，这里收尾防止 unhandled rejection
  } finally {
    backendsLoading.value = false;
  }
});
</script>

<template>
  <setting v-loading="backendsLoading" :model-value="settingData" />
</template>
