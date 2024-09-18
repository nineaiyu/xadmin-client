<script lang="ts" setup>
import { settingsEmailApi } from "@/api/system/settings";
import { computed, ref } from "vue";
import { hasAuth } from "@/router/utils";
import { settingItemProps } from "@/views/system/components/settings/types";
import Setting from "@/views/system/components/settings/index.vue";
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
      update: hasAuth("update:SettingEmail"),
      detail: hasAuth("detail:SettingEmail"),
      test: hasAuth("test:SettingEmail")
    },
    api: settingsEmailApi,
    localeName: "settingMessage",
    title: "mailTitle"
  }
]);

const auth = ref({
  update: hasAuth("update:SettingNotifications"),
  list: hasAuth("list:SettingNotifications"),
  backends: hasAuth("backends:SettingNotifications")
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
