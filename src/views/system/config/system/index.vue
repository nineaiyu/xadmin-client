<script lang="ts" setup>
import { ref } from "vue";
import { useSystemConfig } from "./utils/hook";

defineOptions({
  name: "SystemConfig"
});

const tableRef = ref();

const { api, auth, operationButtonsProps } = useSystemConfig(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="configSystem"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
