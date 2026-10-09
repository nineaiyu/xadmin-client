<script lang="ts" setup>
import { ref } from "vue";

import { userMsgSubscriptionApi } from "@/api/user/notifications";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import AccountPanel from "./AccountPanel.vue";
import MessageNotifications from "@/views/system/components/MessageNotifications.vue";

defineOptions({
  name: "Notifications"
});
const { t } = useI18n();

const auth = ref({
  partialUpdate: hasAuth("partialUpdate:UserMsgSubscription"),
  list: hasAuth("list:UserMsgSubscription"),
  backends: hasAuth("backends:UserMsgSubscription")
});
</script>

<template>
  <AccountPanel
    :title="t('account.notifications')"
    :description="t('account.subCrossHint')"
  >
    <MessageNotifications :api="userMsgSubscriptionApi" :auth="auth" />
  </AccountPanel>
</template>
