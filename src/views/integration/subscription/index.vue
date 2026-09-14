<script lang="ts" setup>
import { ref } from "vue";
import { useWebhookSubscription } from "./utils/hook";

defineOptions({
  name: "WebhookSubscription"
});

const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useWebhookSubscription(tableRef);
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
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
