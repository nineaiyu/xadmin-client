<script lang="ts" setup>
import { ref } from "vue";
import { useTaskExecution } from "./utils/hook";

/**
 * 任务日志：所有 celery 任务的执行记录（定时调度 + 即时执行 + 导出/导入/报表产物任务）。
 *
 * 导出/导入任务与执行记录共用主键，列表按 pk 带出产物信息（类型 / 业务名 / 进度 /
 * 产物文件），因此「看日志 / 取消 / 重跑 / 下载 / 清理」都在本页完成，不再有第二入口。
 */
defineOptions({
  name: "SystemTaskExecution" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  searchColumnsFormat,
  operationButtonsProps
} = useTaskExecution(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemTaskExecution"
    :list-columns-format="listColumnsFormat"
    :searchColumnsFormat="searchColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    saved-views
    advanced-filter
  />
</template>
