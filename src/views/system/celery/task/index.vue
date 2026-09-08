<script lang="ts" setup>
import { useTask } from "./utils/hook";
import { ref } from "vue";

defineOptions({
  name: "SystemTask" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();
const {
  api,
  auth,
  baseColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useTask(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTask"
    :base-columns-format="baseColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
