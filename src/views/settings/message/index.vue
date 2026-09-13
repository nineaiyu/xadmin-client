<script lang="ts" setup>
import { settingsEmailApi, settingsNotifyImApi } from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/settings/components/settings/types";
import Setting from "@/views/settings/components/settings/index.vue";
import { systemMsgSubscriptionApi } from "@/api/system/notifications";
import MessageNotifications from "@/views/system/components/MessageNotifications.vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingMessage"
});
const { t } = useI18n();

const settingData = computed<Array<settingItemProps>>(() => [
  {
    auth: {
      partialUpdate: hasAuth("partialUpdate:EmailServerSetting"),
      retrieve: hasAuth("retrieve:EmailServerSetting"),
      test: hasAuth("create:EmailServerSetting")
    },
    api: settingsEmailApi,
    localeName: "settingMessage",
    title: "mailTitle"
  },
  {
    // 企业 IM 通知渠道（ADR-019）：钉钉/企微/飞书，凭据加密落库
    auth: {
      partialUpdate: hasAuth("partialUpdate:ImNotifySetting"),
      retrieve: hasAuth("retrieve:ImNotifySetting"),
      test: hasAuth("create:ImNotifySetting")
    },
    api: settingsNotifyImApi,
    localeName: "settingMessage",
    title: "imTitle"
  }
]);

const auth = ref({
  partialUpdate: hasAuth("partialUpdate:SystemMsgSubscription"),
  list: hasAuth("list:SystemMsgSubscription"),
  backends: hasAuth("backends:SystemMsgSubscription")
});
</script>

<template>
  <setting :model-value="settingData">
    <el-tab-pane
      v-if="auth.list"
      :label="t('settingMessage.messageTitle')"
      :lazy="true"
    >
      <MessageNotifications
        :api="systemMsgSubscriptionApi"
        :auth="auth"
        :has-operations="true"
        :has-receivers="true"
      />
    </el-tab-pane>
  </setting>
</template>
