<script lang="ts" setup>
import { ref } from "vue";
import { useFlow } from "./utils/hook";

defineOptions({
  name: "SystemApprovalFlow" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
const { api, auth, tableBarButtonsProps, operationButtonsProps } =
  useFlow(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemApprovalFlow"
    :allowAsyncExport="false"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
