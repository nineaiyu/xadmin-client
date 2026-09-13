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

// 企业 IM 通知渠道（ADR-019）：钉钉/企微/飞书各一个独立页签。channel 既是后端字段
// 作用域（retrieve/search-columns/partialUpdate 只读写本渠道），也是测试按钮的定位
// 参数（?channel= 只测本渠道），避免"一个测试按钮测三家"的歧义；fields 白名单为前端
// 兜底，确保字段不跨页签渲染
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
  ...imChannelTabs.map(item => ({
    auth: {
      partialUpdate: hasAuth("partialUpdate:ImNotifySetting"),
      retrieve: hasAuth("retrieve:ImNotifySetting"),
      test: hasAuth("create:ImNotifySetting")
    },
    api: settingsNotifyImApi,
    localeName: "settingMessage",
    title: item.title,
    fields: item.fields,
    queryParams: { channel: item.channel }
  }))
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
