<script lang="ts" setup>
import { ref } from "vue";
import { useMcpServers } from "./utils/hook";

defineOptions({
  name: "AiMcpServers" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useMcpServers(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :selection="false"
    :api="api"
    :auth="auth"
    locale-name="mcp"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
