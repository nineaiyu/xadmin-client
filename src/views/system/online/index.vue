<script lang="ts" setup>
import { useUserOnline } from "./utils/hook";

defineOptions({ name: "SystemUserOnline" });
const {
  api,
  auth,
  tableRef,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useUserOnline();
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="Boolean(auth.batchDestroy)"
    locale-name="systemOnline"
    :listColumnsFormat="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
