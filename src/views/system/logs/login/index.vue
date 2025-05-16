<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";

import { ref } from "vue";

defineOptions({
  name: "SystemUserLoginLog"
});
const tableRef = ref();

const { api, auth, listColumnsFormat, operationButtonsProps } =
  useLoginLog(tableRef);
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
