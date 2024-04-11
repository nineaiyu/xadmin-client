<script lang="ts" setup>
import { ref } from "vue";
import { useRole } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemRole"
});

const tableRef = ref();

const { api, auth, columns, editForm } = useRole(tableRef);
</script>

<template>
  <ReBaseTable
    ref="tableRef"
    :api="api"
    :auth="auth"
    :edit-form="editForm"
    locale-name="systemRole"
    :table-columns="columns"
  />
</template>
