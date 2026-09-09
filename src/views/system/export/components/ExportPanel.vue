<script lang="ts" setup>
import { useExportRecord } from "../utils/hook";

defineOptions({
  name: "ExportRecordPanel"
});
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useExportRecord();
</script>
<template>
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemExportRecord"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
