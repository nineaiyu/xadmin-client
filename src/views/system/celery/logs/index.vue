<script lang="ts" setup>
import { ref } from "vue";
import { useTaskExecution } from "./utils/hook.tsx";
import TaskLogDialog from "../../components/TaskLogDialog.vue";

defineOptions({
  name: "SystemTaskExecution"
});

const tableRef = ref();
const { api, auth, listColumnsFormat, operationButtonsProps, logDialogRef } =
  useTaskExecution();
</script>
<template>
  <!-- 单根节点：pure-admin 路由外层要求单根；不加 class，避免与 RePlusPage 自身 .main 的 padding 叠加 -->
  <div>
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemTaskExecution"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
    />
    <TaskLogDialog ref="logDialogRef" />
  </div>
</template>
