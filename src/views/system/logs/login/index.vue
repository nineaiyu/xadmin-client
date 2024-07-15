<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemUserLoginLog"
});

const { api, auth, listColumnsFormat, operationButtonsProps } = useLoginLog();
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="logsLogin"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
