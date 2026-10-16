<script lang="ts" setup>
import WebhookListPage from "@/views/integration/webhook/components/WebhookListPage.vue";

defineOptions({
  name: "WebhookSubscription"
});
</script>

<template>
  <WebhookListPage mode="subscription" />
</template>
