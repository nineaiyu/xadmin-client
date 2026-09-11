<script lang="ts" setup>
import { ref } from "vue";
import { useInstancePanel, type InstanceScope } from "../utils/hook";

/** 流程审批面板：三页签（待我审批 / 我的申请 / 已办）同构，scope 驱动取值域与按钮 */

defineOptions({
  name: "ApprovalInstancePanel"
});

const props = defineProps<{ scope: InstanceScope }>();
const tableRef = ref();

const {
  api,
  auth,
  operationButtonsProps,
  tableBarButtonsProps,
  listColumnsFormat
} = useInstancePanel(props.scope, tableRef);

/** 供父页面在「发起申请」成功后即时刷新当前页签 */
defineExpose({
  refresh: () => tableRef.value?.handleGetData()
});
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemApprovalInstance"
    :selection="scope === 'pending'"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    :allowAsyncExport="false"
  />
</template>
