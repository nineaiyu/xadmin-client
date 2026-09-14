<script lang="ts" setup>
import { ref } from "vue";
import { useWebhookDelivery } from "./utils/hook";

defineOptions({
  name: "WebhookDelivery"
});

const tableRef = ref();
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useWebhookDelivery(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="webhook"
    :selection="false"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
