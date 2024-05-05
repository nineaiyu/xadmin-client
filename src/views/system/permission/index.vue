<script lang="ts" setup>
import { ref } from "vue";
import { useDataPermission } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemDataPermission"
});

const tableRef = ref();

const { api, auth, columns, editForm } = useDataPermission(tableRef);
</script>
<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    :table-columns="columns"
    locale-name="systemPermission"
  />
</template>
