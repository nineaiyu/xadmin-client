<script lang="ts" setup>
import { reactive, ref } from "vue";
import { useDemoBook } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "DemoBook"
});

const tableRef = ref();

const { api, auth, columns, editForm } = useDemoBook(tableRef);
const pagination = reactive({
  total: 0,
  pageSize: 100,
  currentPage: 1,
  pageSizes: [20, 100, 200, 300, 800],
  background: true
});
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :table-columns="columns"
    :pagination="pagination"
    locale-name="demoBook"
  />
</template>
