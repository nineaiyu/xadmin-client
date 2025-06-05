<script lang="ts" setup>
import { ref } from "vue";
import { useUserConfig } from "./utils/hook";

defineOptions({
  name: "UserConfig"
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
