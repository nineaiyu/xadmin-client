<script lang="ts" setup>
import { useDataDict } from "./utils/hook";

defineOptions({
  name: "SystemDataDict" // 必须定义，用于菜单自动匹配组件
});

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  beforeSearchSubmit,
  searchColumnsFormat,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useDataDict();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :isTree="true"
    :addOrEditOptions="addOrEditOptions"
    :beforeSearchSubmit="beforeSearchSubmit"
    :search-columns-format="searchColumnsFormat"
    :listColumnsFormat="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
    locale-name="dataDict"
  />
</template>
