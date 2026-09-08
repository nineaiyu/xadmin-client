<script lang="ts" setup>
import { useTaskCrontab } from "./utils/hook";

defineOptions({
  name: "SystemTaskCrontab" // 必须定义，用于菜单自动匹配组件
});
const { api, auth, listColumnsFormat } = useTaskCrontab();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemTaskCrontab"
    :list-columns-format="listColumnsFormat"
  />
</template>
