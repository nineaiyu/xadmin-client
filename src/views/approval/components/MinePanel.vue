<script lang="ts" setup>
import { ref } from "vue";
import { useApprovalPanel } from "../utils/hook";

defineOptions({
  name: "ApprovalMinePanel"
});
const tableRef = ref();

const { api, auth, operationButtonsProps, listColumnsFormat } =
  useApprovalPanel("mine", tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="approval"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :allowAsyncExport="false"
  />
</template>
