<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";

defineOptions({
  name: "SystemOperationLog"
});

const {
  api,
  auth,
  listColumnsFormat,
  detailColumnsFormat,
  detailRowFetch,
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
    :detailRowFetch="detailRowFetch"
    :operationButtonsProps="operationButtonsProps"
    advanced-filter
  />
</template>
