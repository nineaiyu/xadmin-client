<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import { RePlusPage } from "@/components/RePlusPage";

defineOptions({
  name: "SystemOperationLog"
});

const {
  api,
  auth,
  listColumnsFormat,
  detailColumnsFormat,
  operationButtonsProps
} = useOperationLog();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="logsOperation"
    :listColumnsFormat="listColumnsFormat"
    :detailColumnsFormat="detailColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
