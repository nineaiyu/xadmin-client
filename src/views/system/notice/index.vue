<script lang="ts" setup>
import { ref } from "vue";
import { useNotice } from "./utils/hook";

defineOptions({
  name: "SystemNotice"
});

const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  searchComplete
} = useNotice(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemNotice"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    @searchComplete="searchComplete"
  />
</template>
