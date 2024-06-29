<script lang="ts" setup>
import { ref } from "vue";
import { useDemoBook } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "DemoBook"
});

const tableRef = ref();

const { api, auth, columns, editForm } = useDemoBook(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :table-columns="columns"
    locale-name="demoBook"
  />
</template>
