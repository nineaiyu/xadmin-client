<script lang="ts" setup>
import { ref } from "vue";
import { useUserConfig } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemUserConfig"
});

const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useUserConfig(tableRef);
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="configUser"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
