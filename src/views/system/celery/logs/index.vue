<script lang="ts" setup>
import { useTaskExecution } from "./utils/hook";

defineOptions({
  name: "SystemTaskExecution" // 必须定义，用于菜单自动匹配组件
});
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useTaskExecution();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemTaskExecution"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
