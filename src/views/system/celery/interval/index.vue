<script lang="ts" setup>
import SchedulePage from "../components/SchedulePage.vue";
import { useTaskInterval } from "./utils/hook";

defineOptions({
  name: "SystemTaskInterval" // 必须定义，用于菜单自动匹配组件
});
const { api, auth, tableRef, listColumnsFormat, operationButtonsProps } =
  useTaskInterval();
</script>
<template>
  <SchedulePage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTaskInterval"
    :list-columns-format="listColumnsFormat"
    :operation-buttons-props="operationButtonsProps"
  />
</template>
