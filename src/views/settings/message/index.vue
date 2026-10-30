<script lang="ts" setup>
// 系统设置 → 消息通知：只保留订阅与文案模板；出站渠道配置在「通知渠道」页。
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { systemMsgSubscriptionApi } from "@/api/system/notifications";
import MessageNotifications from "@/components/ReMessageNotifications";
import MessageTemplatePanel from "./components/MessageTemplatePanel.vue";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingMessage"
});
const { t } = useI18n();

const auth = ref({
  partialUpdate: hasAuth("partialUpdate:SystemMsgSubscription"),
  list: hasAuth("list:SystemMsgSubscription"),
  backends: hasAuth("backends:SystemMsgSubscription"),
  // 消息模板注册表端点（/api/notifications/message-templates）的权限点挂在
  // 本页面（SettingMessage）名下，与订阅面板的模型级权限码来源不同
  templateList: hasAuth("list:SettingMessage"),
  // 订阅面板「发送测试」的独立权限点（编辑接收人复用 partialUpdate）
  test: hasAuth("test:SystemMsgSubscription")
});

const panes = computed<Array<settingsPane>>(() => [
  ...(auth.value.list
    ? [{ key: "notifications", label: t("settingMessage.messageTitle") }]
    : []),
  ...(auth.value.templateList
    ? [{ key: "templates", label: t("messageTemplate.title") }]
    : [])
]);
</script>

<template>
  <setting :panes="panes">
    <template #notifications>
      <MessageNotifications
        :api="systemMsgSubscriptionApi"
        :auth="auth"
        :has-operations="true"
        :has-receivers="true"
      />
    </template>
    <!-- 消息模板：通知文本可配置（代码默认 → DB 覆盖层） -->
    <template #templates>
      <MessageTemplatePanel />
    </template>
  </setting>
</template>
