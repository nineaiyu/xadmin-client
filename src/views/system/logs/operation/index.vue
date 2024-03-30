<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemOperationLog"
});

const { api, auth, columns, searchForm, defaultValue, searchColumns } =
  useOperationLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    :search-columns="searchColumns"
    :search-form="searchForm"
    :table-columns="columns"
  />
</template>
