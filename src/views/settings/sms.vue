<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import {
  settingsSmsConfigApi,
  settingsSmsServerApi
} from "@/api/system/settings";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { settingItemProps } from "@/views/settings/components/settings/types";
import Setting from "@/views/settings/components/settings/index.vue";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import type { RecordType } from "plus-pro-components";

defineOptions({
  name: "SettingSms"
});

const { t } = useI18n();
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
// 拉取失败（业务码或网络异常）：给出可读提示 + 重试入口，避免用户只看到"少了几项"
const backendsFailed = ref(false);

async function loadBackends() {
  if (!hasAuth("backends:SmsSetting")) return;
  backendsLoading.value = true;
  backendsFailed.value = false;
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
    } else {
      backendsFailed.value = true;
      if (res.detail) {
        message(String(res.detail), { type: "warning" });
      }
    }
  } catch {
    // http 层已统一提示；标记失败态，由模板给出重试入口（避免 unhandled rejection）
    backendsFailed.value = true;
  } finally {
    backendsLoading.value = false;
  }
}

onMounted(loadBackends);
</script>

<template>
  <div>
    <el-alert
      v-if="backendsFailed"
      type="warning"
      :closable="false"
      class="sms-setting-notice"
      :title="t('settingSms.backendsLoadFailed')"
    >
      <el-button link type="primary" size="small" @click="loadBackends">
        {{ t("buttons.reload") }}
      </el-button>
    </el-alert>
    <setting v-loading="backendsLoading" :model-value="settingData" />
  </div>
</template>

<style lang="scss" scoped>
/* 页签外的失败提示：与页签卡片同宽铺满，间距取竖排节奏的 12px */
.sms-setting-notice {
  margin-bottom: var(--space-3);
}
</style>
