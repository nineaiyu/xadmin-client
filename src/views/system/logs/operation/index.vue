<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemOperationLog"
});

const { api, auth, columns, searchField, defaultValue, searchColumns } =
  useOperationLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    :search-columns="searchColumns"
    :search-field="searchField"
    :table-columns="columns"
  />
</template>
