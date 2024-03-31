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
  searchForm,
  defaultValue,
  searchColumns,
  openDialog
} = useDataPermission(tableRef);
</script>
<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :custom-add-or-edit="true"
    :search-columns="searchColumns"
    :search-form="searchForm"
    :table-columns="columns"
    @open-dialog="openDialog"
  />
</template>
