<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

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
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="logsOperation"
    :listColumnsFormat="listColumnsFormat"
    :detailColumnsFormat="detailColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
