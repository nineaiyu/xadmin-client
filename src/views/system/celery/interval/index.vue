<script lang="ts" setup>
import { useTaskInterval } from "./utils/hook";

defineOptions({
  name: "SystemTaskInterval" // 必须定义，用于菜单自动匹配组件
});
const { api, auth } = useTaskInterval();
</script>
<template>
  <RePlusPage :api="api" :auth="auth" locale-name="systemTaskInterval" />
</template>
