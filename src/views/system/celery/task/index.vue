<script lang="ts" setup>
import { ref } from "vue";
import { useTask } from "./utils/hook.ts";
import TaskLogDialog from "../../components/TaskLogDialog.vue";

defineOptions({
  name: "SystemTask"
});

const tableRef = ref();
const {
  api,
  auth,
  operationButtonsProps,
  tableBarButtonsProps,
  baseColumnsFormat,
  logDialogRef
} = useTask(tableRef);
</script>
<template>
  <div>
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemTask"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
      :baseColumnsFormat="baseColumnsFormat"
    />
    <!-- 实时执行日志弹窗（与执行历史页共用，WebSocket 增量推送） -->
    <TaskLogDialog ref="logDialogRef" />
  </div>
</template>
