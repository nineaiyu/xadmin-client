<script lang="ts" setup>
import { ref } from "vue";
import { useSystemUploadFile } from "./utils/hook";

defineOptions({
  name: "SystemUploadFile"
});

const tableRef = ref();

const {
  api,
  auth,
  listColumnsFormat,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps
} = useSystemUploadFile(tableRef);
</script>

<template>
  <!-- FEAT-2：回收站入口（auth.recycleList 显隐），列 label 按 localeName 自动翻译 -->
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemUploadFile"
    :listColumnsFormat="listColumnsFormat"
    :addOrEditOptions="addOrEditOptions"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    :recycleBin="[{ prop: 'filename' }]"
  />
</template>
