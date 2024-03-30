<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemUserLoginLog"
});

const { api, auth, columns, searchForm, defaultValue, searchColumns } =
  useLoginLog();
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
