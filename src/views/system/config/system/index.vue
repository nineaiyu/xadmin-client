<script lang="ts" setup>
import { ref } from "vue";
import { useSystemConfig } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemConfig"
});

const tableRef = ref();

const { api, auth, operationButtonsProps } = useSystemConfig(tableRef);
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="configSystem"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
