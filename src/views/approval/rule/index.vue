<script lang="ts" setup>
import { ref } from "vue";
import { useApprovalRule } from "./utils/hook";

defineOptions({
  name: "SystemApprovalRule" // 必须定义，用于菜单自动匹配组件与权限码后缀
});
const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  operationButtonsProps,
  listColumnsFormat
} = useApprovalRule();
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="Boolean(auth.batchDestroy)"
    :addOrEditOptions="addOrEditOptions"
    locale-name="approvalRule"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :allowAsyncExport="false"
  />
</template>
