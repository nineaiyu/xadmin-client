<script lang="ts" setup>
import { ref } from "vue";
import { useDataPermission } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

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
    locale-name="systemPermission"
    :table-columns="columns"
  />
</template>
