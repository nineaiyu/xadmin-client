<script lang="ts" setup>
import { useExportRecord } from "./utils/hook";

defineOptions({
  name: "SystemExportRecord" // 必须定义，用于菜单自动匹配组件
});
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useExportRecord();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemExportRecord"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
