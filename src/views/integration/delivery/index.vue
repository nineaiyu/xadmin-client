<script lang="ts" setup>
import WebhookListPage from "@/views/integration/webhook/components/WebhookListPage.vue";

defineOptions({
  name: "WebhookDelivery"
});
</script>

<template>
  <WebhookListPage mode="delivery" />
</template>
