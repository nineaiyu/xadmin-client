<script lang="ts" setup>
import { useDemoBook } from "./utils/hook";
import { ref } from "vue";

defineOptions({
  name: "DemoBook" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();
const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  searchColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useDemoBook(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="demoBook"
    :search-columns-format="searchColumnsFormat"
    :add-or-edit-options="addOrEditOptions"
    :list-columns-format="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
