<script lang="ts" setup>
import { usePluginNote } from "./utils/hook";

// 组件名即路由匹配键（菜单种子的 name / 权限点后缀都按它对齐），改名即断路由
defineOptions({
  name: "PluginNote"
});

const { api, auth, tableRef } = usePluginNote();
</script>

<template>
  <RePlusPage ref="tableRef" :api="api" :auth="auth" locale-name="pluginNote" />
</template>
