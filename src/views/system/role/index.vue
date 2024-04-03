<script lang="ts" setup>
import { ref } from "vue";
import { useRole } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemRole"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  columns,
  editForm,
  searchField,
  defaultValue,
  searchColumns,
  openDialog
} = useRole(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :search-columns="searchColumns"
    :search-field="searchField"
    :table-columns="columns"
    :custom-add-or-edit="true"
    @open-dialog="openDialog"
  />
</template>
