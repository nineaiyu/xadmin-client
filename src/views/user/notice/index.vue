<script lang="ts" setup>
import { ref } from "vue";
import { useUserNotice } from "./utils/hook";
import { RePlusPage } from "@/components/RePlusPage";

defineOptions({
  name: "UserNotice"
});

const tableRef = ref();

const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps,
  selectionChange,
  searchComplete
} = useUserNotice(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="userNotice"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    @searchComplete="searchComplete"
    @selectionChange="selectionChange"
  />
</template>
