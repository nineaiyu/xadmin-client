<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";

defineOptions({
  name: "SystemOperationLog"
});

const { api, auth, listColumnsFormat, operationButtonsProps } =
  useOperationLog();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="logsOperation"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
