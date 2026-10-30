<script lang="ts" setup>
import { useNotice } from "./utils/hook";

defineOptions({
  name: "SystemNotice"
});

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  detailRowFetch,
  searchComplete
} = useNotice();
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="Boolean(auth.batchDestroy)"
    locale-name="systemNotice"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :detailRowFetch="detailRowFetch"
    recycleBin
    viewed-row
    @searchComplete="searchComplete"
  />
</template>
