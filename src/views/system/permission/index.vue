<script lang="ts" setup>
import { useDataPermission } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemDataPermission"
});

const { api, auth, addOrEditOptions, operationButtonsProps } =
  useDataPermission();
</script>
<template>
  <RePlusCRUD
    :api="api"
    :auth="auth"
    locale-name="systemPermission"
    :addOrEditOptions="addOrEditOptions"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
