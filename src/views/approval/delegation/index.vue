<script lang="ts" setup>
import { useApprovalDelegation } from "./utils/hook";

defineOptions({
  name: "SystemApprovalDelegation" // 必须定义，用于菜单自动匹配组件
});
const { api, auth, listColumnsFormat } = useApprovalDelegation();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemApprovalDelegation"
    :listColumnsFormat="listColumnsFormat"
  />
</template>
