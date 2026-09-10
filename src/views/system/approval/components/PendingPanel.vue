<script lang="ts" setup>
import { ref } from "vue";
import { useApprovalPanel } from "../utils/hook";

defineOptions({
  name: "ApprovalPendingPanel"
});
const tableRef = ref();

const {
  api,
  auth,
  operationButtonsProps,
  tableBarButtonsProps,
  listColumnsFormat
} = useApprovalPanel("pending", tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="approval"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    :allowAsyncExport="false"
  />
</template>
