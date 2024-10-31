<script lang="ts" setup>
import { ref } from "vue";

import { userMsgSubscriptionApi } from "@/api/user/notifications";
import { useI18n } from "vue-i18n";
import { deviceDetection } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import MessageNotifications from "@/views/system/components/MessageNotifications.vue";

defineOptions({
  name: "Notifications"
});
const { t } = useI18n();

const auth = ref({
  partialUpdate: hasAuth("partialUpdate:UserMsgSubscription"),
  list: hasAuth("list:UserMsgSubscription"),
  backends: hasAuth("retrieve:NotificationsBackend")
});
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.notifications") }}</h3>
    <MessageNotifications :api="userMsgSubscriptionApi" :auth="auth" />
  </div>
</template>
