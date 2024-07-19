<script lang="ts" setup>
import { useRole } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemRole"
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useRole();
</script>

<template>
  <RePlusCRUD
    :api="api"
    :auth="auth"
    locale-name="systemRole"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
