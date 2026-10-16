<script lang="ts" setup>
import { ref } from "vue";
import { useDataDict } from "./utils/hook";

defineOptions({
  name: "SystemDataDict" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  beforeSearchSubmit,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useDataDict(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :isTree="true"
    :addOrEditOptions="addOrEditOptions"
    :beforeSearchSubmit="beforeSearchSubmit"
    :listColumnsFormat="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
    locale-name="dataDict"
  />
</template>
