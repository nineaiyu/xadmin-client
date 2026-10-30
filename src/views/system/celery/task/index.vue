<script lang="ts" setup>
import { hasBatchSelection } from "@/views/system/components/batchSelection";
import { useTask } from "./utils/hook";

defineOptions({
  name: "SystemTask" // 必须定义，用于菜单自动匹配组件
});
const {
  api,
  auth,
  tableRef,
  baseColumnsFormat,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useTask();
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="
      hasBatchSelection(auth, [
        'batchRun:SystemTask',
        'batchEnable:SystemTask',
        'batchDisable:SystemTask'
      ])
    "
    locale-name="systemTask"
    saved-views
    :base-columns-format="baseColumnsFormat"
    :list-columns-format="listColumnsFormat"
    :tableBarButtonsProps="tableBarButtonsProps"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
