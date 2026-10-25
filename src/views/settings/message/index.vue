<script lang="ts" setup>
import {
  settingsEmailApi,
  settingsNotifyImApi,
  settingsNotifyWebhookApi
} from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { systemMsgSubscriptionApi } from "@/api/system/notifications";
import MessageNotifications from "@/components/ReMessageNotifications";
import MessageTemplatePanel from "./components/MessageTemplatePanel.vue";
import { settingAuth } from "@/views/settings/utils/settingAuth";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "SettingMessage"
});
const { t } = useI18n();

// 企业 IM 通知渠道：钉钉/企微/飞书各一个独立面板。channel 既是后端字段
// 作用域（retrieve/search-columns/partialUpdate 只读写本渠道），也是测试按钮的定位
// 参数（?channel= 只测本渠道），避免"一个测试按钮测三家"的歧义；fields 白名单为前端
// 兜底，确保字段不跨面板渲染
const imChannelTabs: Array<{
  title: string;
  channel: string;
  fields: string[];
}> = [
  {
    title: "dingtalkTitle",
    channel: "dingtalk",
    fields: [
      "DINGTALK_ENABLED",
      "DINGTALK_APP_KEY",
      "DINGTALK_APP_SECRET",
      "DINGTALK_AGENT_ID"
    ]
  },
  {
    title: "wecomTitle",
    channel: "wecom",
    fields: [
      "WECOM_ENABLED",
      "WECOM_CORP_ID",
      "WECOM_CORP_SECRET",
      "WECOM_AGENT_ID"
    ]
  },
  {
    title: "feishuTitle",
    channel: "feishu",
    fields: ["FEISHU_ENABLED", "FEISHU_APP_ID", "FEISHU_APP_SECRET"]
  }
];

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
  {
    key: "email",
    item: {
      auth: settingAuth("EmailServerSetting", true),
      api: settingsEmailApi,
      localeName: "settingMessage",
      title: "mailTitle"
    }
  },
  ...imChannelTabs.map(item => ({
    key: item.channel,
    item: {
      auth: settingAuth("ImNotifySetting", true),
      api: settingsNotifyImApi,
      localeName: "settingMessage",
      title: item.title,
      fields: item.fields,
      queryParams: { channel: item.channel }
    }
  })),
  // Webhook 转发渠道：站点级端点（无 channel 作用域，ViewSet 即单渠道字段面）
  {
    key: "webhook",
    item: {
      auth: settingAuth("WebhookNotifySetting", true),
      api: settingsNotifyWebhookApi,
      localeName: "settingMessage",
      title: "webhookTitle",
      fields: ["WEBHOOK_ENABLED", "WEBHOOK_URL", "WEBHOOK_SECRET"]
    }
  },
  // 消息通知订阅（列表型自定义面板）与消息模板：无对应权限时不并入导航
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
