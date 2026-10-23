<script lang="ts" setup>
import { useUserConfig } from "./utils/hook";

defineOptions({
  name: "UserConfig"
});

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useUserConfig();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="configUser"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
