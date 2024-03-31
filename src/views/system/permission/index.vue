<script lang="ts" setup>
import { ref } from "vue";
import { useDataPermission } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemDataPermission"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  editForm,
  searchForm,
  defaultValue,
  searchColumns
} = useDataPermission(tableRef);
</script>
<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :search-columns="searchColumns"
    :search-form="searchForm"
    :table-columns="columns"
  />
</template>
