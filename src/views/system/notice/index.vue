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
  <!-- FEAT-2：回收站入口（auth.recycleList 显隐），列 label 按 localeName 自动翻译 -->
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemNotice"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :recycleBin="[{ prop: 'title' }]"
    @searchComplete="searchComplete"
  />
</template>
