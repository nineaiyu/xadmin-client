<script lang="ts" setup>
import SchedulePage from "../components/SchedulePage.vue";
import { useTaskCrontab } from "./utils/hook";

defineOptions({
  name: "SystemTaskCrontab" // 必须定义，用于菜单自动匹配组件
});
const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useTaskCrontab();
</script>
<template>
  <SchedulePage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTaskCrontab"
    :add-or-edit-options="addOrEditOptions"
    :list-columns-format="listColumnsFormat"
    :operation-buttons-props="operationButtonsProps"
  />
</template>
