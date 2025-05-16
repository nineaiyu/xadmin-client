<script lang="ts" setup>
import { ref } from "vue";
import { useNoticeRead } from "./hook";

defineOptions({
  name: "SystemNoticeRead"
});

const tableRef = ref();

const { api, auth, listColumnsFormat, operationButtonsProps } =
  useNoticeRead(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="noticeRead"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
