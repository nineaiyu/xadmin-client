<script lang="ts" setup>
import { useDataPermission } from "./utils/hook";

defineOptions({
  name: "SystemDataPermission"
});

const { api, auth, addOrEditOptions, operationButtonsProps } =
  useDataPermission();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemPermission"
    :addOrEditOptions="addOrEditOptions"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
