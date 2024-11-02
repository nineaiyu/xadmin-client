<script lang="ts" setup>
import { RePlusPage } from "@/components/RePlusPage";
import { useDemoBook } from "./utils/hook";

defineOptions({
  name: "DemoBook" // 必须定义，用于菜单自动匹配组件
});
const { api, auth } = useDemoBook();
</script>
<template>
  <RePlusPage :api="api" :auth="auth" locale-name="demoBook" />
</template>
