<script lang="ts" setup>
import { useRole } from "./utils/hook";

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
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemRole"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
