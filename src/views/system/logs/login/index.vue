<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";
import { RePlusPage } from "@/components/RePlusPage";

defineOptions({
  name: "SystemUserLoginLog"
});

const { api, auth, listColumnsFormat, operationButtonsProps } = useLoginLog();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="logsLogin"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
