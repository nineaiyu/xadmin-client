<script lang="ts" setup>
import { ref } from "vue";
import { useMask } from "./utils/hook";

defineOptions({
  name: "SystemDataMaskRule" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useMask();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
    locale-name="mask"
  />
</template>
