<script lang="ts" setup>
import { useImportRecord } from "../utils/importHook";

defineOptions({
  name: "ImportRecordPanel"
});
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useImportRecord();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemImportRecord"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
