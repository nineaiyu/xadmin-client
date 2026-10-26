<script lang="ts" setup>
// 系统设置 → 通知渠道：邮件、钉钉、企业微信、飞书、Webhook 的出站配置。
// IM 渠道用 ?channel= 收敛后端字段面与测试目标，各页签只读写自己的凭据。
import {
  settingsEmailApi,
  settingsNotifyImApi,
  settingsNotifyWebhookApi
} from "@/api/system/settings";
import { computed } from "vue";
import Setting from "@/views/settings/components/settings-shell/index.vue";
import { settingsPane } from "@/views/settings/components/settings-shell/types";
import { settingAuth } from "@/views/settings/utils/settingAuth";

defineOptions({
  name: "SettingChannel"
});

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

const panes = computed<Array<settingsPane>>(() => [
  {
    key: "email",
    item: {
      auth: settingAuth("EmailServerSetting", true),
      api: settingsEmailApi,
      localeName: "settingChannel",
      title: "mailTitle"
    }
  },
  ...imChannelTabs.map(item => ({
    key: item.channel,
    item: {
      auth: settingAuth("ImNotifySetting", true),
      api: settingsNotifyImApi,
      localeName: "settingChannel",
      title: item.title,
      fields: item.fields,
      queryParams: { channel: item.channel }
    }
  })),
  {
    key: "webhook",
    item: {
      auth: settingAuth("WebhookNotifySetting", true),
      api: settingsNotifyWebhookApi,
      localeName: "settingChannel",
      title: "webhookTitle",
      fields: ["WEBHOOK_ENABLED", "WEBHOOK_URL", "WEBHOOK_SECRET"]
    }
  }
]);
</script>

<template>
  <setting :panes="panes" />
</template>
