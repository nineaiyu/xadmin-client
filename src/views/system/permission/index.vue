<script lang="ts" setup>
import { useDataPermission } from "./utils/hook";

defineOptions({
  name: "SystemDataPermission"
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useDataPermission();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemPermission"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
