<script lang="ts" setup>
import { useNoticeRead } from "./hook";

defineOptions({
  name: "SystemNoticeRead"
});

const {
  api,
  auth,
  tableRef,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useNoticeRead();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="noticeRead"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
