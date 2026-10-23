<script lang="ts" setup>
import { useSystemConfig } from "./utils/hook";

defineOptions({
  name: "SystemConfig"
});

const { api, auth, tableRef, baseColumnsFormat, operationButtonsProps } =
  useSystemConfig();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="configSystem"
    :baseColumnsFormat="baseColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
