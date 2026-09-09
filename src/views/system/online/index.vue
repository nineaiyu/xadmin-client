<script lang="ts" setup>
import { ref } from "vue";
import { useUserOnline } from "./utils/hook";

defineOptions({ name: "SystemUserOnline" });
const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useUserOnline(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="userOnline"
    :listColumnsFormat="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
