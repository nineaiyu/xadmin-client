<script lang="ts" setup>
import { computed, ref } from "vue";
import { approvalSelectionEnabled } from "@/views/approval/utils/batchSelection";
import { useInstancePanel, type InstanceScope } from "../utils/hook";

/** 流程审批面板：三页签（待我审批 / 我的申请 / 已办）同构，scope 驱动取值域与按钮 */

defineOptions({
  name: "ApprovalInstancePanel"
});

const props = defineProps<{
  scope: InstanceScope;
  /** 发起申请成功后的页面级回调（刷新角标/切页签） */
  onStart?: () => void;
}>();
const tableRef = ref();

const {
  api,
  auth,
  operationButtonsProps,
  tableBarButtonsProps,
  listColumnsFormat
} = useInstancePanel(props.scope, tableRef, props.onStart);

/** 勾选列只在待办页签且存在批量动作权限时开启（与工具栏批量按钮同口径） */
const selection = computed(() =>
  approvalSelectionEnabled(props.scope, auth, [
    "batchApprove",
    "batchReject",
    "batchTransfer"
  ])
);

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
    :selection="selection"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
