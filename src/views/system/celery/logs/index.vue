<script lang="ts" setup>
import { useTaskExecution } from "./utils/hook";

/**
 * 执行历史页（已停用）：菜单 is_active=false，执行历史收敛到任务中心
 * （views/system/task，能力等价且带取消/重跑/产物下载）。组件与权限点保留，
 * 便于按需恢复：把 loadjson/menu.json 中该菜单的 is_active 改回 true 并重灌种子。
 */
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
