<script lang="ts" setup>
import { ref } from "vue";
import { useApprovalPanel, type ApprovalScope } from "../utils/hook";

/** 审批中心面板：待我审批 / 我发起的两页签同构，scope 驱动列表过滤与批量工具栏
 * （与流程审批 InstancePanel 同一范式）。批量按钮只在待审批页签装配——
 * 「我发起的」无批量处置语义，历史行为如此，收敛时保持不变。 */

defineOptions({
  name: "ApprovalPanel"
});

const props = defineProps<{ scope: ApprovalScope }>();
const tableRef = ref();

const {
  api,
  auth,
  operationButtonsProps,
  tableBarButtonsProps,
  listColumnsFormat
} = useApprovalPanel(props.scope, tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="approval"
    :selection="true"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="
      scope === 'pending' ? tableBarButtonsProps : undefined
    "
    :allowAsyncExport="false"
  />
</template>
